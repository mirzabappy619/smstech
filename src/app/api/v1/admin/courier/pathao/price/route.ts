import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS, validateRequest } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';
import { z } from 'zod';

const priceRequestSchema = z.object({
  store_id: z.number(),
  item_type: z.number(),
  delivery_type: z.number(),
  item_weight: z.number(),
  recipient_city: z.number(),
  recipient_zone: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, priceRequestSchema);
    if (validationError) return validationError;

    const supabase = await createAdminClient();
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }

    const pathaoService = new PathaoService(settings);
    const price = await pathaoService.calculatePrice(data);

    return successResponse(price);
  } catch (error: any) {
    console.error('Pathao price POST error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to calculate price', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
