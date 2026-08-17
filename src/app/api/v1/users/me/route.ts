import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse, validationErrorResponse } from '@/lib/api-utils';
import { z } from 'zod';

const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional(),
});

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, avatar_url, role, created_at')
      .eq('id', user.id)
      .single();

    if (error) {
      return errorResponse('NOT_FOUND', 'Profile not found', 404);
    }

    return jsonResponse(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);
    
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { data: profile, error } = await supabase
      .from('users')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, first_name, last_name, phone, avatar_url, role')
      .single();

    if (error) {
      return errorResponse('UPDATE_FAILED', 'Failed to update profile', 500);
    }

    return jsonResponse(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
