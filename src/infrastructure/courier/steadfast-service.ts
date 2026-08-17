import { CourierSettings, SteadfastOrderRequest, SteadfastOrderResponse, SteadfastStatusResponse } from './courier-types';
import { logger } from '@/infrastructure/logging/logger';

export class SteadfastService {
  private settings: CourierSettings;
  private readonly baseUrl = 'https://portal.steadfast.com.bd/api/v1';

  constructor(settings: CourierSettings) {
    this.settings = settings;
  }

  private get headers(): Record<string, string> {
    return {
      'Api-Key': this.settings.steadfast_api_key || '',
      'Secret-Key': this.settings.steadfast_secret_key || '',
      'Content-Type': 'application/json',
    };
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Steadfast API error for ${url}`, { status: response.status, errorText });
      throw new Error(`Steadfast API failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createOrder(orderData: SteadfastOrderRequest): Promise<SteadfastOrderResponse> {
    const data = await this.fetchApi('/create_order', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    
    // Check Steadfast specific error format
    if (data.status !== 200) {
      throw new Error(`Steadfast order creation failed: ${JSON.stringify(data)}`);
    }
    
    return data.consignment; // Return the consignment object
  }

  async getStatusByConsignmentId(id: string): Promise<SteadfastStatusResponse> {
    const data = await this.fetchApi(`/status_by_cid/${id}`);
    return data;
  }

  async getStatusByInvoice(invoice: string): Promise<SteadfastStatusResponse> {
    const data = await this.fetchApi(`/status_by_invoice/${invoice}`);
    return data;
  }

  async getStatusByTrackingCode(code: string): Promise<SteadfastStatusResponse> {
    const data = await this.fetchApi(`/status_by_trackingcode/${code}`);
    return data;
  }

  async getBalance(): Promise<any> {
    const data = await this.fetchApi('/get_balance');
    return data;
  }
}
