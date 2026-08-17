export type CourierProvider = 'pathao' | 'steadfast';

export interface CourierSettings {
  id: string;
  pathao_client_id: string | null;
  pathao_client_secret: string | null;
  pathao_username: string | null;
  pathao_password: string | null;
  pathao_access_token: string | null;
  pathao_refresh_token: string | null;
  pathao_token_expires_at: string | null;
  pathao_default_store_id: number | null;
  pathao_environment: 'sandbox' | 'production' | string;
  steadfast_api_key: string | null;
  steadfast_secret_key: string | null;
  default_provider: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourierSendResult {
  consignmentId: string;
  trackingCode: string | null;
  status: string;
  deliveryFee: number | null;
  rawResponse: Record<string, unknown>;
}

export interface CourierStatusResult {
  status: string;
  trackingCode: string | null;
  updatedAt: string | null;
}

// --- Pathao Types ---
export interface PathaoToken {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface PathaoStore {
  store_id: number;
  store_name: string;
  store_address: string;
}

export interface PathaoCity {
  city_id: number;
  city_name: string;
}

export interface PathaoZone {
  zone_id: number;
  zone_name: string;
}

export interface PathaoArea {
  area_id: number;
  area_name: string;
}

export interface PathaoOrderRequest {
  store_id: number;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_secondary_phone?: string;
  recipient_address: string;
  recipient_city?: number;
  recipient_zone?: number;
  recipient_area?: number;
  delivery_type: number;
  item_type: number;
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;
  amount_to_collect: number;
  item_description?: string;
}

export interface PathaoOrderResponse {
  consignment_id: string;
  merchant_order_id: string;
  order_status: string;
  delivery_fee: number;
}

export interface PathaoPricePlan {
  store_id: number;
  item_type: number;
  delivery_type: number;
  item_weight: number;
  recipient_city: number;
  recipient_zone: number;
  price?: number;
}

// --- Steadfast Types ---
export interface SteadfastOrderRequest {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

export interface SteadfastOrderResponse {
  consignment_id: string;
  invoice: string;
  tracking_code: string;
  status: string;
}

export interface SteadfastConsignment {
  consignment_id: string;
  invoice: string;
  tracking_code: string;
  status: string;
}

export interface SteadfastStatusResponse {
  delivery_status: string;
  consignment_id?: string;
  tracking_code?: string;
}
