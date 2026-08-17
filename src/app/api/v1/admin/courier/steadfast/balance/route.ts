import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { SteadfastService } from '@/infrastructure/courier/steadfast-service';

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
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not configured', HTTP_STATUS.NOT_FOUND);
    }

    if (!settings.steadfast_api_key || !settings.steadfast_secret_key) {
      return errorResponse('MISSING_CREDENTIALS', 'Steadfast API key and Secret key are required', HTTP_STATUS.BAD_REQUEST);
    }

    const steadfastService = new SteadfastService(settings);
    const balance = await steadfastService.getBalance();

    return successResponse(balance);
  } catch (error: unknown) {
    console.error('Steadfast balance GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch Steadfast balance';
    return errorResponse('STEADFAST_ERROR', message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
