import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { successResponse, errorResponse, validationErrorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { z } from 'zod';
import { resolveProfileId } from '@/lib/account';

const addToWishlistSchema = z.object({
  product_id: z.string().uuid(),
});

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const profileId = await resolveProfileId(supabase, user.id);
    if (!profileId) {
      return errorResponse('USER_NOT_FOUND', 'User profile not found', 404);
    }

    const { data: wishlist, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        created_at,
        products (
          id,
          name,
          slug,
          base_price,
          compare_at_price,
          images
        )
      `)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse('FETCH_FAILED', 'Failed to fetch wishlist', 500);
    }

    return successResponse(wishlist);
  } catch (error) {
    console.error('Get wishlist error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await request.json();
    const validation = addToWishlistSchema.safeParse(body);
    
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const profileId = await resolveProfileId(supabase, user.id);
    if (!profileId) {
      return errorResponse('USER_NOT_FOUND', 'User profile not found', 404);
    }

    // Check if product exists
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', validation.data.product_id)
      .single();

    if (!product) {
      return errorResponse('NOT_FOUND', 'Product not found', 404);
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', profileId)
      .eq('product_id', validation.data.product_id)
      .maybeSingle();

    if (existing) {
      return errorResponse('CONFLICT', 'Product already in wishlist', 409);
    }

    const { data: wishlistItem, error } = await supabase
      .from('wishlists')
      .insert({
        user_id: profileId,
        product_id: validation.data.product_id,
      })
      .select()
      .single();

    if (error) {
      return errorResponse('CREATE_FAILED', 'Failed to add to wishlist', 500);
    }

    return successResponse(wishlistItem, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');

    if (!productId) {
      return errorResponse('BAD_REQUEST', 'Product ID is required', 400);
    }

    const profileId = await resolveProfileId(supabase, user.id);
    if (!profileId) {
      return errorResponse('USER_NOT_FOUND', 'User profile not found', 404);
    }

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', profileId)
      .eq('product_id', productId);

    if (error) {
      return errorResponse('DELETE_FAILED', 'Failed to remove from wishlist', 500);
    }

    return successResponse({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    return errorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
