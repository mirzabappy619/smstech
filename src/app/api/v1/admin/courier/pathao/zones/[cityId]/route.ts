import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;
    
    const { cityId } = await params;
    const cityIdNumber = parseInt(cityId, 10);
    
    if (isNaN(cityIdNumber)) {
      return errorResponse('INVALID_PARAMS', 'cityId must be a number', HTTP_STATUS.BAD_REQUEST);
    }

    const supabase = await createAdminClient();
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }

    const pathaoService = new PathaoService(settings);
    const zones = await pathaoService.getZones(cityIdNumber);

    return successResponse(zones);
  } catch (error: any) {
    console.error('Pathao zones GET error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to fetch zones', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
