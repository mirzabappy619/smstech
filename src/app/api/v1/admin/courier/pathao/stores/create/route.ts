import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS, validateRequest } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';
import { z } from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(3).max(50),
  contact_name: z.string().min(3).max(50),
  contact_number: z.string().length(11),
  secondary_contact: z.string().length(11).optional(),
  address: z.string().min(15).max(120),
  city_id: z.number().int().positive(),
  zone_id: z.number().int().positive(),
  area_id: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, createStoreSchema);
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
    // Call Pathao API to create store
    const storeResult = await pathaoService.createStore(data);

    return successResponse(storeResult);
  } catch (error: any) {
    console.error('Pathao store creation POST error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to create Pathao store', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
