import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/infrastructure/logging/logger';
import { 
  CourierSettings, 
  CourierProvider, 
  CourierSendResult, 
  CourierStatusResult,
  PathaoOrderRequest,
  SteadfastOrderRequest
} from './courier-types';
import { PathaoService } from './pathao-service';
import { SteadfastService } from './steadfast-service';

export * from './courier-types';
export * from './pathao-service';
export * from './steadfast-service';

export class CourierService {
  static async getSettings(): Promise<CourierSettings | null> {
    try {
      const supabase = await createAdminClient();
      const { data, error } = await supabase
        .from('courier_settings')
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error('Failed to fetch courier settings', { error });
        return null;
      }

      return data as CourierSettings;
    } catch (error) {
      logger.error('Error in CourierService.getSettings', { error });
      return null;
    }
  }

  static async updateSettings(settings: Partial<CourierSettings>): Promise<boolean> {
    try {
      const supabase = await createAdminClient();
      const { error } = await supabase
        .from('courier_settings')
        .update(settings)
        .eq('id', settings.id);

      if (error) {
        logger.error('Failed to update courier settings', { error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in CourierService.updateSettings', { error });
      return false;
    }
  }

  static async updateTokens(accessToken: string, refreshToken: string, expiresAt: string): Promise<boolean> {
    try {
      const supabase = await createAdminClient();
      const settings = await this.getSettings();
      if (!settings) return false;

      const { error } = await supabase
        .from('courier_settings')
        .update({
          pathao_access_token: accessToken,
          pathao_refresh_token: refreshToken,
          pathao_token_expires_at: expiresAt,
        })
        .eq('id', settings.id);

      if (error) {
        logger.error('Failed to update tokens', { error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in CourierService.updateTokens', { error });
      return false;
    }
  }

  static async sendOrder(
    orderId: string, 
    provider: CourierProvider, 
    options?: { storeId?: number }
  ): Promise<CourierSendResult> {
    try {
      const settings = await this.getSettings();
      if (!settings || !settings.is_active) {
        throw new Error('Courier integration is disabled');
      }

      const supabase = await createAdminClient();
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (id)
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const shippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : (order.shipping_address || {});
        
      const recipientName = shippingAddress.name || shippingAddress.fullName || 'Customer';
      const recipientPhone = shippingAddress.phone || '00000000000';
      const recipientAddress = shippingAddress.address || shippingAddress.street || 'Address not provided';
      const totalAmount = parseFloat(order.total ?? order.total_amount ?? '0');
      
      // Determine if it's COD
      // If payment_status is 'pending', assuming COD amount needs to be collected
      const codAmount = order.payment_status === 'pending' ? totalAmount : 0;
      
      let result: CourierSendResult;

      if (provider === 'pathao') {
        const pathao = new PathaoService(settings);
        
        const requestData: PathaoOrderRequest = {
          store_id: options?.storeId || settings.pathao_default_store_id || 388178,
          merchant_order_id: order.order_number,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_address: recipientAddress,
          delivery_type: 48, // normal
          item_type: 2, // parcel
          item_quantity: order.order_items?.length || 1,
          item_weight: 0.5,
          amount_to_collect: codAmount,
        };

        const response = await pathao.createOrder(requestData);
        
        result = {
          consignmentId: response.consignment_id,
          trackingCode: null, // Pathao tracks via consignment id
          status: response.order_status || 'Pending',
          deliveryFee: response.delivery_fee,
          rawResponse: response as unknown as Record<string, unknown>,
        };
      } else if (provider === 'steadfast') {
        const steadfast = new SteadfastService(settings);
        
        const requestData: SteadfastOrderRequest = {
          invoice: order.order_number,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_address: recipientAddress,
          cod_amount: codAmount,
        };

        const response = await steadfast.createOrder(requestData);
        
        result = {
          consignmentId: response.consignment_id,
          trackingCode: response.tracking_code,
          status: response.status || 'pending',
          deliveryFee: null,
          rawResponse: response as unknown as Record<string, unknown>,
        };
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Update order in database
      await supabase
        .from('orders')
        .update({
          courier_provider: provider,
          courier_consignment_id: result.consignmentId,
          courier_tracking_code: result.trackingCode,
          courier_status: result.status,
          courier_delivery_fee: result.deliveryFee,
          courier_data: result.rawResponse,
          courier_sent_at: new Date().toISOString(),
          status: 'shipped',
          tracking_number: result.trackingCode || result.consignmentId,
        })
        .eq('id', orderId);

      return result;
    } catch (error) {
      logger.error('Error in CourierService.sendOrder', { error, orderId, provider });
      throw error;
    }
  }

  static async getStatus(orderId: string): Promise<CourierStatusResult | null> {
    try {
      const supabase = await createAdminClient();
      const { data: order, error } = await supabase
        .from('orders')
        .select('courier_provider, courier_consignment_id')
        .eq('id', orderId)
        .single();

      if (error || !order || !order.courier_provider || !order.courier_consignment_id) {
        return null;
      }

      const settings = await this.getSettings();
      if (!settings) return null;

      let statusResult: CourierStatusResult;

      if (order.courier_provider === 'pathao') {
        const pathao = new PathaoService(settings);
        const info = await pathao.getOrderInfo(order.courier_consignment_id);
        
        statusResult = {
          status: info.order_status,
          trackingCode: null,
          updatedAt: new Date().toISOString(),
        };
      } else if (order.courier_provider === 'steadfast') {
        const steadfast = new SteadfastService(settings);
        const info = await steadfast.getStatusByConsignmentId(order.courier_consignment_id);
        
        statusResult = {
          status: info.delivery_status,
          trackingCode: info.tracking_code || null,
          updatedAt: new Date().toISOString(),
        };
      } else {
        return null;
      }

      // Update order status if retrieved successfully
      await supabase
        .from('orders')
        .update({
          courier_status: statusResult.status,
          ...(statusResult.trackingCode ? { courier_tracking_code: statusResult.trackingCode } : {}),
        })
        .eq('id', orderId);

      return statusResult;
    } catch (error) {
      logger.error('Error in CourierService.getStatus', { error, orderId });
      return null;
    }
  }
}
