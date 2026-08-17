// API Route Handlers - Consolidated module
// These will be split into individual route files after setup.sh is run

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { 
  successResponse, 
  errorResponse, 
  paginatedResponse,
  requireAuth,
  requireAdmin,
  validateRequest,
  logActivity
} from '@/lib/api-utils';
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  orderFiltersSchema,
  addToCartSchema,
  updateCartItemSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createCategorySchema,
  adjustInventorySchema,
  inventoryFiltersSchema,
} from './schemas';

// ==============================================
// PRODUCTS API
// ==============================================

export async function getProducts(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = productFiltersSchema.parse(Object.fromEntries(searchParams));

    const supabase = await createServerClient();
    
    let query = supabase
      .from('products')
      .select('*, category:categories(*), variations:product_variations(*)', { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (filters.category) {
      query = query.eq('category_id', filters.category);
    }
    if (filters.minPrice !== undefined) {
      query = query.gte('base_price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte('base_price', filters.maxPrice);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    if (filters.featured !== undefined) {
      query = query.eq('is_featured', filters.featured);
    }

    // Sorting
    query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });

    // Pagination
    const from = (filters.page - 1) * filters.perPage;
    const to = from + filters.perPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return paginatedResponse(data || [], filters.page, filters.perPage, count || 0);
  } catch (error) {
    return errorResponse('FETCH_PRODUCTS_ERROR', error instanceof Error ? error.message : 'Failed to fetch products', 500);
  }
}

export async function getProductBySlug(slug: string) {
  try {
    const supabase = await createServerClient();
    
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variations:product_variations(*),
        reviews:reviews(*, user:users(first_name, last_name, avatar_url))
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('PRODUCT_NOT_FOUND', 'Product not found', 404);
      }
      throw error;
    }

    return successResponse(data);
  } catch (error) {
    return errorResponse('FETCH_PRODUCT_ERROR', error instanceof Error ? error.message : 'Failed to fetch product', 500);
  }
}

export async function createProduct(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, createProductSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();
    
    const { variations, ...productData } = validation.data;
    
    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (productError) throw productError;

    // Create variations if provided
    if (variations && variations.length > 0) {
      const variationsWithProductId = variations.map(v => ({
        ...v,
        product_id: product.id
      }));

      const { error: varError } = await supabase
        .from('product_variations')
        .insert(variationsWithProductId);

      if (varError) throw varError;
    }

    await logActivity('create', 'product', product.id, auth.user.id, null, null, request);

    return successResponse(product, 201);
  } catch (error) {
    return errorResponse('CREATE_PRODUCT_ERROR', error instanceof Error ? error.message : 'Failed to create product', 500);
  }
}

export async function updateProduct(request: NextRequest, productId: string) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, updateProductSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from('products')
      .update(validation)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    await logActivity('update', 'product', productId, auth.user.id, null, null, request);

    return successResponse(data);
  } catch (error) {
    return errorResponse('UPDATE_PRODUCT_ERROR', error instanceof Error ? error.message : 'Failed to update product', 500);
  }
}

export async function deleteProduct(request: NextRequest, productId: string) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const supabase = await createAdminClient();
    
    // Soft delete - just deactivate
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);

    if (error) throw error;

    await logActivity('delete', 'product', productId, auth.user.id, null, null, request);

    return successResponse({ message: 'Product deleted successfully' });
  } catch (error) {
    return errorResponse('DELETE_PRODUCT_ERROR', error instanceof Error ? error.message : 'Failed to delete product', 500);
  }
}

// ==============================================
// CATEGORIES API
// ==============================================

export async function getCategories() {
  try {
    const supabase = await createServerClient();
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;

    return successResponse(data);
  } catch (error) {
    return errorResponse('FETCH_CATEGORIES_ERROR', error instanceof Error ? error.message : 'Failed to fetch categories', 500);
  }
}

export async function createCategory(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, createCategorySchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from('categories')
      .insert(validation)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (error) {
    return errorResponse('CREATE_CATEGORY_ERROR', error instanceof Error ? error.message : 'Failed to create category', 500);
  }
}

// ==============================================
// ORDERS API
// ==============================================

export async function getOrders(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = orderFiltersSchema.parse(Object.fromEntries(searchParams));

    const supabase = await createServerClient();
    
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)', { count: 'exact' });

    // Non-admin users can only see their own orders
    if (auth.user.role !== 'admin' && auth.user.role !== 'owner') {
      query = query.eq('user_id', auth.user.id);
    } else if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.order('created_at', { ascending: false });

    // Pagination
    const from = (filters.page - 1) * filters.perPage;
    const to = from + filters.perPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return paginatedResponse(data || [], filters.page, filters.perPage, count || 0);
  } catch (error) {
    return errorResponse('FETCH_ORDERS_ERROR', error instanceof Error ? error.message : 'Failed to fetch orders', 500);
  }
}

export async function getOrderById(request: NextRequest, orderId: string) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const supabase = await createServerClient();
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        notes:order_notes(*),
        user:users(id, email, first_name, last_name)
      `)
      .eq('id', orderId);

    // Non-admin users can only see their own orders
    if (auth.user.role !== 'admin' && auth.user.role !== 'owner') {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('ORDER_NOT_FOUND', 'Order not found', 404);
      }
      throw error;
    }

    return successResponse(data);
  } catch (error) {
    return errorResponse('FETCH_ORDER_ERROR', error instanceof Error ? error.message : 'Failed to fetch order', 500);
  }
}

export async function createOrder(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, createOrderSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();
    
    // Start transaction-like operations
    // 1. Validate items and get prices
    const itemPrices: { productId: string; price: number; name: string; sku: string }[] = [];
    let subtotal = 0;

    for (const item of validation.data.items) {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, sku, base_price, is_active')
        .eq('id', item.productId)
        .eq('is_active', true)
        .single();

      if (!product) {
        return errorResponse('PRODUCT_NOT_FOUND_OR_INACTIVE', `Product ${item.productId} not found or inactive`, 400);
      }

      // Check inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('available_quantity')
        .eq('product_id', item.productId)
        .single();

      if (inventory && inventory.available_quantity < item.quantity) {
        return errorResponse('INSUFFICIENT_STOCK', `Insufficient stock for ${product.name}`, 400);
      }

      itemPrices.push({
        productId: product.id,
        price: product.base_price,
        name: product.name,
        sku: product.sku
      });
      subtotal += product.base_price * item.quantity;
    }

    // 2. Calculate totals
    let discountAmount = 0;
    let couponId = null;
    
    if (validation.data.couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', validation.data.couponCode)
        .eq('is_active', true)
        .single();

      if (coupon) {
        if (coupon.type === 'percentage') {
          discountAmount = (subtotal * coupon.value) / 100;
        } else if (coupon.type === 'fixed') {
          discountAmount = coupon.value;
        }
        if (coupon.max_discount_amount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
        }
        couponId = coupon.id;
      }
    }

    // Get shipping rate
    const { data: zone } = await supabase
      .from('delivery_zones')
      .select('*')
      .contains('postal_codes', [validation.data.shippingAddress.postalCode])
      .eq('is_active', true)
      .single();

    const shippingAmount = zone?.shipping_rate || 0;
    const freeShippingThreshold = zone?.min_order_for_free || 9999;
    const finalShipping = subtotal >= freeShippingThreshold ? 0 : shippingAmount;

    // Tax calculation (simplified - 8%)
    const taxRate = 0.08;
    const taxAmount = (subtotal - discountAmount) * taxRate;

    const total = subtotal - discountAmount + finalShipping + taxAmount;

    // 3. Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: auth.user.id,
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        discount_amount: discountAmount,
        shipping_amount: finalShipping,
        tax_amount: taxAmount,
        total,
        coupon_id: couponId,
        coupon_code: validation.data.couponCode,
        shipping_address: validation.data.shippingAddress,
        billing_address: validation.data.billingAddress || validation.data.shippingAddress,
        payment_method: validation.data.paymentMethod,
        customer_notes: validation.data.notes,
        delivery_zone_id: zone?.id,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 4. Create order items
    const orderItems = validation.data.items.map((item, index) => ({
      order_id: order.id,
      product_id: item.productId,
      variation_id: item.variationId,
      sku: itemPrices[index].sku,
      name: itemPrices[index].name,
      quantity: item.quantity,
      unit_price: itemPrices[index].price,
      total_price: itemPrices[index].price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // 5. Reserve inventory
    for (const item of validation.data.items) {
      await supabase.rpc('reserve_inventory', {
        p_product_id: item.productId,
        p_quantity: item.quantity,
        p_order_id: order.id
      });
    }

    // 6. Update coupon usage
    if (couponId) {
      await supabase
        .from('coupons')
        .update({ uses_count: supabase.rpc('increment', { x: 1 }) })
        .eq('id', couponId);
    }

    await logActivity('create', 'order', order.id, auth.user.id, null, null, request);

    return successResponse({
      ...order,
      items: orderItems
    }, 201);
  } catch (error) {
    return errorResponse('CREATE_ORDER_ERROR', error instanceof Error ? error.message : 'Failed to create order', 500);
  }
}

export async function updateOrderStatus(request: NextRequest, orderId: string) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, updateOrderStatusSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    const updateData: Record<string, unknown> = { status: validation.data.status };
    
    if (validation.data.trackingNumber) {
      updateData.tracking_number = validation.data.trackingNumber;
    }
    if (validation.data.estimatedDelivery) {
      updateData.estimated_delivery = validation.data.estimatedDelivery;
    }
    if (validation.data.status === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    }
    if (validation.data.status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }
    if (validation.data.status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancellation_reason = validation.data.notes;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Add internal note
    if (validation.data.notes) {
      await supabase
        .from('order_notes')
        .insert({
          order_id: orderId,
          user_id: auth.user.id,
          note: `Status changed to ${validation.data.status}: ${validation.data.notes}`,
          is_internal: true
        });
    }

    await logActivity('update', 'order', orderId, auth.user.id, null, null, request);

    return successResponse(data);
  } catch (error) {
    return errorResponse('UPDATE_ORDER_ERROR', error instanceof Error ? error.message : 'Failed to update order', 500);
  }
}

// ==============================================
// CART API
// ==============================================

export async function getCart(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const supabase = await createServerClient();
    
    const { data: cart, error } = await supabase
      .from('carts')
      .select(`
        *,
        items:cart_items(
          *,
          product:products(id, name, slug, images, base_price),
          variation:product_variations(id, name, price, attributes)
        ),
        coupon:coupons(id, code, type, value)
      `)
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No cart exists, return empty cart
        return successResponse({
          id: null,
          items: [],
          subtotal: 0,
          discount_amount: 0,
          shipping_amount: 0,
          tax_amount: 0,
          total: 0,
          coupon: null
        });
      }
      throw error;
    }

    return successResponse(cart);
  } catch (error) {
    return errorResponse('FETCH_CART_ERROR', error instanceof Error ? error.message : 'Failed to fetch cart', 500);
  }
}

export async function addToCart(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, addToCartSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();
    
    // Get or create cart
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ user_id: auth.user.id })
        .select('id')
        .single();
      cart = newCart;
    }

    if (!cart) {
      return errorResponse('CREATE_CART_ERROR', 'Failed to create cart', 500);
    }

    // Get product price
    const { data: product } = await supabase
      .from('products')
      .select('id, base_price, is_active')
      .eq('id', validation.data.productId)
      .eq('is_active', true)
      .single();

    if (!product) {
      return errorResponse('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    let unitPrice = product.base_price;

    // Check for variation price
    if (validation.data.variationId) {
      const { data: variation } = await supabase
        .from('product_variations')
        .select('price')
        .eq('id', validation.data.variationId)
        .single();

      if (variation) {
        unitPrice = variation.price;
      }
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', validation.data.productId)
      .eq('variation_id', validation.data.variationId || null)
      .single();

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + validation.data.quantity;
      const { data, error } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
          total_price: unitPrice * newQuantity
        })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      return successResponse(data);
    }

    // Add new item
    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id: validation.data.productId,
        variation_id: validation.data.variationId,
        quantity: validation.data.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * validation.data.quantity!
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (error) {
    return errorResponse('ADD_TO_CART_ERROR', error instanceof Error ? error.message : 'Failed to add to cart', 500);
  }
}

export async function updateCartItem(request: NextRequest, itemId: string) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, updateCartItemSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    if (validation.data.quantity === 0) {
      // Delete item
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return successResponse({ message: 'Item removed from cart' });
    }

    // Get current item to calculate new total
    const { data: item } = await supabase
      .from('cart_items')
      .select('unit_price')
      .eq('id', itemId)
      .single();

    if (!item) {
      return errorResponse('CART_ITEM_NOT_FOUND', 'Cart item not found', 404);
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({
        quantity: validation.data.quantity,
        total_price: item.unit_price * validation.data.quantity
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (error) {
    return errorResponse('UPDATE_CART_ITEM_ERROR', error instanceof Error ? error.message : 'Failed to update cart item', 500);
  }
}

export async function removeCartItem(request: NextRequest, itemId: string) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const supabase = await createAdminClient();

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    return successResponse({ message: 'Item removed from cart' });
  } catch (error) {
    return errorResponse('REMOVE_CART_ITEM_ERROR', error instanceof Error ? error.message : 'Failed to remove cart item', 500);
  }
}

// ==============================================
// AUTH API
// ==============================================

export async function register(request: NextRequest) {
  try {
    const validation = await validateRequest(request, registerSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validation.data.email)
      .single();

    if (existingUser) {
      return errorResponse('EMAIL_ALREADY_REGISTERED', 'Email already registered', 409);
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: validation.data.email,
      password: validation.data.password,
      email_confirm: true
    });

    if (authError) throw authError;

    // Create user record
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email: validation.data.email,
        first_name: validation.data.firstName,
        last_name: validation.data.lastName,
        phone: validation.data.phone,
        role: 'customer'
      })
      .select()
      .single();

    if (userError) throw userError;

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      message: 'Registration successful'
    }, 201);
  } catch (error) {
    return errorResponse('REGISTRATION_ERROR', error instanceof Error ? error.message : 'Registration failed', 500);
  }
}

export async function login(request: NextRequest) {
  try {
    const validation = await validateRequest(request, loginSchema);
    if (validation.error) return validation.error;

    const supabase = await createServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password
    });

    if (error) {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Update last login
    const admin = await createAdminClient();
    await admin
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        failed_login_attempts: 0
      })
      .eq('auth_id', data.user.id);

    return successResponse({
      user: data.user,
      session: data.session
    });
  } catch (error) {
    return errorResponse('LOGIN_ERROR', error instanceof Error ? error.message : 'Login failed', 500);
  }
}

export async function logout(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    return errorResponse('LOGOUT_ERROR', error instanceof Error ? error.message : 'Logout failed', 500);
  }
}

export async function getCurrentUser(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const supabase = await createServerClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('*, addresses(*)')
      .eq('id', auth.user.id)
      .single();

    if (error) throw error;

    return successResponse(user);
  } catch (error) {
    return errorResponse('FETCH_USER_ERROR', error instanceof Error ? error.message : 'Failed to get user', 500);
  }
}

export async function updateProfile(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, updateProfileSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (validation.data.firstName) updateData.first_name = validation.data.firstName;
    if (validation.data.lastName) updateData.last_name = validation.data.lastName;
    if (validation.data.phone) updateData.phone = validation.data.phone;
    if (validation.data.avatarUrl) updateData.avatar_url = validation.data.avatarUrl;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', auth.user.id)
      .select()
      .single();

    if (error) throw error;

    return successResponse(data);
  } catch (error) {
    return errorResponse('UPDATE_PROFILE_ERROR', error instanceof Error ? error.message : 'Failed to update profile', 500);
  }
}

// ==============================================
// INVENTORY API
// ==============================================

export async function getInventory(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const filters = inventoryFiltersSchema.parse(Object.fromEntries(searchParams));

    const supabase = await createServerClient();
    
    let query = supabase
      .from('inventory')
      .select(`
        *,
        product:products(id, name, sku, images),
        variation:product_variations(id, name, sku),
        location:locations(id, name, code)
      `, { count: 'exact' });

    if (filters.locationId) {
      query = query.eq('location_id', filters.locationId);
    }
    if (filters.lowStock) {
      query = query.lte('available_quantity', supabase.rpc('get_reorder_point'));
    }
    if (filters.outOfStock) {
      query = query.eq('available_quantity', 0);
    }

    // Pagination
    const from = (filters.page - 1) * filters.perPage;
    const to = from + filters.perPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    return paginatedResponse(data || [], filters.page, filters.perPage, count || 0);
  } catch (error) {
    return errorResponse('FETCH_INVENTORY_ERROR', error instanceof Error ? error.message : 'Failed to fetch inventory', 500);
  }
}

export async function adjustInventory(request: NextRequest, inventoryId: string) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const validation = await validateRequest(request, adjustInventorySchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    // Get current inventory
    const { data: inventory, error: getError } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('id', inventoryId)
      .single();

    if (getError) throw getError;

    const newQuantity = inventory.quantity + validation.data.quantity;
    
    if (newQuantity < 0) {
      return errorResponse('INSUFFICIENT_INVENTORY', 'Insufficient inventory', 400);
    }

    // Update inventory
    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: newQuantity })
      .eq('id', inventoryId)
      .select()
      .single();

    if (error) throw error;

    // Log the adjustment
    await supabase.from('inventory_logs').insert({
      inventory_id: inventoryId,
      adjustment_type: validation.data.quantity > 0 ? 'adjustment' : 'sale',
      quantity_change: validation.data.quantity,
      quantity_before: inventory.quantity,
      quantity_after: newQuantity,
      reason: validation.data.reason,
      order_id: validation.data.orderId,
      user_id: auth.user.id
    });

    await logActivity('update', 'inventory', inventoryId, auth.user.id, null, null, request);

    return successResponse(data);
  } catch (error) {
    return errorResponse('ADJUST_INVENTORY_ERROR', error instanceof Error ? error.message : 'Failed to adjust inventory', 500);
  }
}

// ==============================================
// ANALYTICS API
// ==============================================

export async function getSalesAnalytics(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    const supabase = await createServerClient();

    // Get order stats
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total, status, payment_status, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('payment_status', ['paid', 'partially_refunded']);

    if (error) throw error;

    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const orderCount = orders?.length || 0;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Group by date
    const salesByDay: Record<string, number> = {};
    orders?.forEach(order => {
      const date = order.created_at.split('T')[0];
      salesByDay[date] = (salesByDay[date] || 0) + order.total;
    });

    return successResponse({
      period: { startDate, endDate },
      summary: {
        totalRevenue,
        orderCount,
        averageOrderValue
      },
      salesByDay: Object.entries(salesByDay).map(([date, revenue]) => ({ date, revenue }))
    });
  } catch (error) {
    return errorResponse('FETCH_ANALYTICS_ERROR', error instanceof Error ? error.message : 'Failed to fetch analytics', 500);
  }
}

export async function getAdminDashboard(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const supabase = await createServerClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Parallel queries for dashboard data
    const [
      ordersToday,
      pendingOrders,
      lowStockProducts,
      recentOrders
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('total', { count: 'exact' })
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString()),
      
      supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .eq('status', 'pending'),
      
      supabase
        .from('inventory')
        .select('product_id', { count: 'exact' })
        .lte('available_quantity', 10),
      
      supabase
        .from('orders')
        .select('id, order_number, total, status, created_at, user:users(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    const todayRevenue = ordersToday.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

    return successResponse({
      todayStats: {
        ordersCount: ordersToday.count || 0,
        revenue: todayRevenue
      },
      alerts: {
        pendingOrders: pendingOrders.count || 0,
        lowStockProducts: lowStockProducts.count || 0
      },
      recentOrders: recentOrders.data || []
    });
  } catch (error) {
    return errorResponse('FETCH_DASHBOARD_ERROR', error instanceof Error ? error.message : 'Failed to fetch dashboard', 500);
  }
}

// ==============================================
// WEBHOOKS API
// ==============================================

export async function handlePaymentWebhook(request: NextRequest) {
  try {
    const body = await request.json();
    // Verify webhook signature (implement based on payment provider)
    // const isValid = verifySignature(body, signature);
    // if (!isValid) return errorResponse('Invalid signature', 401);

    const supabase = await createAdminClient();

    const { event, data } = body;

    switch (event) {
      case 'payment.succeeded':
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_id: data.payment_id,
            paid_at: new Date().toISOString()
          })
          .eq('id', data.order_id);
        break;

      case 'payment.failed':
        await supabase
          .from('orders')
          .update({
            payment_status: 'failed'
          })
          .eq('id', data.order_id);
        break;

      case 'refund.succeeded':
        await supabase
          .from('orders')
          .update({
            payment_status: 'refunded',
            refunded_amount: data.amount
          })
          .eq('id', data.order_id);
        break;
    }

    return successResponse({ received: true });
  } catch (error) {
    return errorResponse('WEBHOOK_PROCESSING_ERROR', error instanceof Error ? error.message : 'Webhook processing failed', 500);
  }
}

export async function handleDeliveryWebhook(request: NextRequest) {
  try {
    const body = await request.json();

    const supabase = await createAdminClient();

    const { event, data } = body;

    switch (event) {
      case 'shipment.picked_up':
        await supabase
          .from('orders')
          .update({
            status: 'shipped',
            shipped_at: new Date().toISOString(),
            tracking_number: data.tracking_number,
            tracking_url: data.tracking_url
          })
          .eq('id', data.order_id);
        break;

      case 'shipment.out_for_delivery':
        await supabase
          .from('orders')
          .update({
            status: 'out_for_delivery',
            estimated_delivery: data.eta
          })
          .eq('id', data.order_id);
        break;

      case 'shipment.delivered':
        await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', data.order_id);
        break;
    }

    return successResponse({ received: true });
  } catch (error) {
    return errorResponse('WEBHOOK_PROCESSING_ERROR', error instanceof Error ? error.message : 'Webhook processing failed', 500);
  }
}

// ==============================================
// HEALTH CHECK
// ==============================================

export async function healthCheck() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
