import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS, validateRequest } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  pathao_client_id: z.string().nullable().optional(),
  pathao_client_secret: z.string().nullable().optional(),
  pathao_username: z.string().nullable().optional(),
  pathao_password: z.string().nullable().optional(),
  pathao_default_store_id: z.number().nullable().optional(),
  pathao_environment: z.enum(['sandbox', 'production']).optional(),
  steadfast_api_key: z.string().nullable().optional(),
  steadfast_secret_key: z.string().nullable().optional(),
  default_provider: z.enum(['pathao', 'steadfast', 'none']).optional(),
  is_active: z.boolean().optional(),
});

function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  if (secret.length <= 4) return '*'.repeat(secret.length);
  return '*'.repeat(secret.length - 4) + secret.slice(-4);
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const supabase = await createAdminClient();
    
    const { data: settings, error } = await supabase
      .from('courier_settings')
      .select('*')
      .single();
      
    if (error && error.code !== 'PGRST116') {
      return errorResponse('DATABASE_ERROR', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
    
    if (!settings) {
      return successResponse(null);
    }

    // Mask sensitive fields
    const maskedSettings = {
      ...settings,
      pathao_client_secret: maskSecret(settings.pathao_client_secret),
      pathao_password: maskSecret(settings.pathao_password),
      steadfast_secret_key: maskSecret(settings.steadfast_secret_key),
    };

    return successResponse(maskedSettings);
  } catch (error) {
    console.error('Courier settings GET error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, updateSettingsSchema);
    if (validationError) return validationError;

    const supabase = await createAdminClient();

    // Fetch existing first to check if we need to insert or update
    const { data: existing } = await supabase
      .from('courier_settings')
      .select('id')
      .single();

    const cleanData: Record<string, any> = {
      ...data,
      pathao_access_token: null,
      pathao_refresh_token: null,
      pathao_token_expires_at: null,
    };
    if (cleanData.pathao_client_secret && cleanData.pathao_client_secret.includes('*')) {
      delete cleanData.pathao_client_secret;
    }
    if (cleanData.pathao_password && cleanData.pathao_password.includes('*')) {
      delete cleanData.pathao_password;
    }
    if (cleanData.steadfast_secret_key && cleanData.steadfast_secret_key.includes('*')) {
      delete cleanData.steadfast_secret_key;
    }

    let result;
    if (existing) {
      result = await supabase
        .from('courier_settings')
        .update({ ...cleanData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('courier_settings')
        .insert({ ...cleanData })
        .select()
        .single();
    }

    if (result.error) {
      return errorResponse('DATABASE_ERROR', result.error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const maskedSettings = {
      ...result.data,
      pathao_client_secret: maskSecret(result.data.pathao_client_secret),
      pathao_password: maskSecret(result.data.pathao_password),
      steadfast_secret_key: maskSecret(result.data.steadfast_secret_key),
    };

    return successResponse(maskedSettings);
  } catch (error) {
    console.error('Courier settings PUT error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
