import { CourierSettings, PathaoToken, PathaoStore, PathaoCity, PathaoZone, PathaoArea, PathaoOrderRequest, PathaoOrderResponse, PathaoPricePlan } from './courier-types';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/infrastructure/logging/logger';

export class PathaoService {
  private settings: CourierSettings;

  constructor(settings: CourierSettings) {
    this.settings = settings;
  }

  private get baseUrl(): string {
    return this.settings.pathao_environment === 'production'
      ? 'https://api-hermes.pathao.com'
      : 'https://courier-api-sandbox.pathao.com';
  }

  private parseErrorMessage(errorText: string, fallback: string): string {
    try {
      const parsed = JSON.parse(errorText);
      if (parsed && typeof parsed === 'object') {
        let msg = typeof parsed.message === 'string' ? parsed.message.trim() : '';

        if (parsed.errors && typeof parsed.errors === 'object') {
          const fieldErrors = Object.entries(parsed.errors)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
            .join('; ');
          if (fieldErrors) {
            msg = msg ? `${msg} (${fieldErrors})` : fieldErrors;
          }
        } else if (typeof parsed.errors === 'string' && parsed.errors.trim()) {
          msg = msg ? `${msg} - ${parsed.errors.trim()}` : parsed.errors.trim();
        }

        if (msg) return msg;
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          return parsed.error.trim();
        }
      }
    } catch {}
    return fallback;
  }

  async issueToken(): Promise<PathaoToken> {
    const response = await fetch(`${this.baseUrl}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.settings.pathao_client_id,
        client_secret: this.settings.pathao_client_secret,
        username: this.settings.pathao_username,
        password: this.settings.pathao_password,
        grant_type: 'password',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Pathao issueToken failed', { errorData });
      const details = this.parseErrorMessage(errorData, response.statusText || 'Invalid credentials');
      throw new Error(`Pathao authentication failed: ${details}`);
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<PathaoToken> {
    const response = await fetch(`${this.baseUrl}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.settings.pathao_client_id,
        client_secret: this.settings.pathao_client_secret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('Pathao refreshToken failed', { errorData });
      const details = this.parseErrorMessage(errorData, response.statusText || 'Invalid token');
      throw new Error(`Pathao token refresh failed: ${details}`);
    }

    return response.json();
  }

  async getValidToken(): Promise<string> {
    const now = new Date();
    
    // Check if token exists and is valid (with 5 minute buffer)
    if (
      this.settings.pathao_access_token &&
      this.settings.pathao_token_expires_at &&
      new Date(this.settings.pathao_token_expires_at).getTime() > now.getTime() + 5 * 60000
    ) {
      return this.settings.pathao_access_token;
    }

    let tokenData: PathaoToken;
    if (this.settings.pathao_refresh_token) {
      try {
        tokenData = await this.refreshToken(this.settings.pathao_refresh_token);
      } catch (error) {
        logger.warn('Token refresh failed, attempting to issue new token with credentials', { error });
        tokenData = await this.issueToken();
      }
    } else {
      tokenData = await this.issueToken();
    }

    const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000).toISOString();
    
    // Update DB
    const supabase = await createAdminClient();
    await supabase
      .from('courier_settings')
      .update({
        pathao_access_token: tokenData.access_token,
        pathao_refresh_token: tokenData.refresh_token,
        pathao_token_expires_at: expiresAt,
      })
      .eq('id', this.settings.id);
      
    // Update local settings instance
    this.settings.pathao_access_token = tokenData.access_token;
    this.settings.pathao_refresh_token = tokenData.refresh_token;
    this.settings.pathao_token_expires_at = expiresAt;

    return tokenData.access_token;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}, isRetry = false): Promise<any> {
    const token = await this.getValidToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 && !isRetry) {
      logger.warn('Pathao API returned 401 Unauthorized. Invalidating cached token and retrying with fresh credentials...');
      
      // Invalidate local and stored tokens
      this.settings.pathao_access_token = null as any;
      this.settings.pathao_refresh_token = null as any;
      this.settings.pathao_token_expires_at = null as any;

      try {
        const supabase = await createAdminClient();
        await supabase
          .from('courier_settings')
          .update({
            pathao_access_token: null,
            pathao_refresh_token: null,
            pathao_token_expires_at: null,
          })
          .eq('id', this.settings.id);
      } catch (err) {
        logger.error('Failed to clear expired token in DB', { err });
      }

      return this.fetchWithAuth(url, options, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 PATHAO API ERROR [${response.status}] for ${url}:\n`, errorText);
      logger.error(`Pathao API error for ${url}`, { status: response.status, errorText });
      const details = this.parseErrorMessage(errorText, response.statusText || `HTTP ${response.status}`);
      throw new Error(`Pathao API error: ${details}`);
    }

    const data = await response.json();
    return data.data; // Pathao typically wraps responses in a 'data' object
  }

  async getStores(): Promise<PathaoStore[]> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/stores`);
  }

  async createStore(storeData: {
    name: string;
    contact_name: string;
    contact_number: string;
    secondary_contact?: string;
    address: string;
    city_id: number;
    zone_id: number;
    area_id: number;
  }): Promise<any> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/stores`, {
      method: 'POST',
      body: JSON.stringify(storeData),
    });
  }

  async getCities(): Promise<PathaoCity[]> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/city-list`);
  }

  async getZones(cityId: number): Promise<PathaoZone[]> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`);
  }

  async getAreas(zoneId: number): Promise<PathaoArea[]> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/zones/${zoneId}/area-list`);
  }

  async calculatePrice(params: PathaoPricePlan): Promise<any> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/merchant/price-plan`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createOrder(orderData: PathaoOrderRequest): Promise<PathaoOrderResponse> {
    const payload: Record<string, any> = {
      store_id: Number(orderData.store_id || 404788),
      merchant_order_id: String(orderData.merchant_order_id || `ORD-${Date.now()}`),
      recipient_name: orderData.recipient_name,
      recipient_phone: orderData.recipient_phone,
      recipient_address: orderData.recipient_address,
      delivery_type: Number(orderData.delivery_type || 48),
      item_type: Number(orderData.item_type || 2),
      special_instruction: orderData.special_instruction?.trim() || 'Handle with care',
      item_quantity: Number(orderData.item_quantity || 1),
      item_weight: Number(orderData.item_weight || 0.5),
      item_description: orderData.item_description?.trim() || 'E-commerce goods',
      amount_to_collect: Math.round(Number(orderData.amount_to_collect ?? 0)),
    };

    if (orderData.recipient_secondary_phone && orderData.recipient_secondary_phone.trim()) {
      payload.recipient_secondary_phone = orderData.recipient_secondary_phone.trim();
    }
    if (orderData.recipient_city && Number(orderData.recipient_city) > 0) {
      payload.recipient_city = Number(orderData.recipient_city);
    }
    if (orderData.recipient_zone && Number(orderData.recipient_zone) > 0) {
      payload.recipient_zone = Number(orderData.recipient_zone);
    }
    if (orderData.recipient_area && Number(orderData.recipient_area) > 0) {
      payload.recipient_area = Number(orderData.recipient_area);
    }

    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getOrderInfo(consignmentId: string): Promise<any> {
    return this.fetchWithAuth(`${this.baseUrl}/aladdin/api/v1/orders/${consignmentId}/info`);
  }
}
