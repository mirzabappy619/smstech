import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS, validateRequest } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';
import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from '@/lib/bd-phone-validator';
import { z } from 'zod';

const directOrderSchema = z.object({
  store_id: z.number().int().positive(),
  merchant_order_id: z.string().optional(),
  recipient_name: z.string().min(3).max(100),
  recipient_phone: z.string().refine((val: string) => isValidBDPhone(val), {
    message: BD_PHONE_ERROR_MESSAGE,
  }),
  recipient_secondary_phone: z.string().optional().or(z.literal('')).refine((val: string | undefined) => !val || isValidBDPhone(val), {
    message: BD_PHONE_ERROR_MESSAGE,
  }),
  recipient_address: z.string().min(10).max(220),
  recipient_city: z.number().int().positive().optional(),
  recipient_zone: z.number().int().positive().optional(),
  recipient_area: z.number().int().positive().optional(),
  delivery_type: z.number().int(), // 48 or 12
  item_type: z.number().int(), // 1 for Doc, 2 for Parcel
  special_instruction: z.string().optional(),
  item_quantity: z.number().int().positive().default(1),
  item_weight: z.number().positive().min(0.5).max(10).default(0.5),
  item_description: z.string().optional(),
  amount_to_collect: z.number().min(0).default(0),
});

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const cloned = request.clone();
    const rawBody = await cloned.json().catch(() => null);
    console.log("📦 [POST create-direct-order] Incoming Payload:\n", JSON.stringify(rawBody, null, 2));

    const { data, error: validationError } = await validateRequest(request, directOrderSchema);
    if (validationError) {
      console.error("❌ [POST create-direct-order] Zod Validation Failed:\n", JSON.stringify(validationError, null, 2));
      return validationError;
    }

    const supabase = await createAdminClient();
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      console.error("❌ [POST create-direct-order] Courier Settings Not Found:", settingsError);
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }

    const pathaoService = new PathaoService(settings);

    // Call Pathao order creation API
    const result = await pathaoService.createOrder({
      store_id: data.store_id,
      merchant_order_id: data.merchant_order_id || `DIR-${Date.now().toString().slice(-6)}`,
      recipient_name: data.recipient_name,
      recipient_phone: normalizeBDPhone(data.recipient_phone),
      recipient_secondary_phone: data.recipient_secondary_phone ? normalizeBDPhone(data.recipient_secondary_phone) : undefined,
      recipient_address: data.recipient_address,
      recipient_city: data.recipient_city,
      recipient_zone: data.recipient_zone,
      recipient_area: data.recipient_area,
      delivery_type: data.delivery_type,
      item_type: data.item_type,
      special_instruction: data.special_instruction,
      item_quantity: data.item_quantity ?? 1,
      item_weight: data.item_weight ?? 0.5,
      item_description: data.item_description,
      amount_to_collect: Math.round(data.amount_to_collect ?? 0),
    });

    console.log("✅ [POST create-direct-order] Order Created Successfully:", result);
    return successResponse(result);
  } catch (error: any) {
    console.error('🔴 [POST create-direct-order] Exception Error:\n', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to create Pathao delivery', HTTP_STATUS.BAD_REQUEST);
  }
}
