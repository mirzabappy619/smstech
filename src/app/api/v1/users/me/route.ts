import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse, validationErrorResponse } from '@/lib/api-utils';
import { z } from 'zod';
import { joinFullName, splitFullName } from '@/lib/name';

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

    // `user.id` is the Supabase auth id; the profile row keys off auth_id.
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, avatar_url, role, created_at')
      .eq('auth_id', user.id)
      .single();

    if (error || !profile) {
      return errorResponse('NOT_FOUND', 'Profile not found', 404);
    }

    return jsonResponse({ ...profile, ...splitFullName(profile.full_name) });
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

    const { first_name, last_name, ...rest } = validation.data;

    // The table stores a single full_name, so a partial name update has to be
    // merged onto whatever is already stored.
    const updates: Record<string, unknown> = {
      ...rest,
      updated_at: new Date().toISOString(),
    };

    if (first_name !== undefined || last_name !== undefined) {
      const { data: current } = await supabase
        .from('users')
        .select('full_name')
        .eq('auth_id', user.id)
        .single();
      const existing = splitFullName(current?.full_name);
      updates.full_name = joinFullName(
        first_name ?? existing.first_name,
        last_name ?? existing.last_name,
      );
    }

    const { data: profile, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_id', user.id)
      .select('id, email, full_name, phone, avatar_url, role')
      .single();

    if (error || !profile) {
      return errorResponse('UPDATE_FAILED', 'Failed to update profile', 500);
    }

    return jsonResponse({ ...profile, ...splitFullName(profile.full_name) });
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
