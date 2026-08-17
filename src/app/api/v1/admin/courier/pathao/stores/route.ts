import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const supabase = await createAdminClient();
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }

    const pathaoService = new PathaoService(settings);
    const stores = await pathaoService.getStores();

    return successResponse(stores);
  } catch (error: any) {
    console.error('Pathao stores GET error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to fetch stores', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
