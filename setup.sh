#!/bin/bash
# E-Commerce Monolith Setup Script
# Run with: bash setup.sh

set -e

# Allow running from any directory
cd "$(dirname "$0")" || cd /home/ab/Documents/GitHub/ecom-mono

echo "🚀 Setting up E-Commerce Monolith..."
echo ""

# 1. Create directory structure
echo "📁 Creating directory structure..."

# Core architecture directories
mkdir -p src/config
mkdir -p src/lib
mkdir -p src/domain/{entities,value-objects,repositories,services,events}
mkdir -p src/application/use-cases/{product,order,user,cart,inventory,delivery,notification,admin,analytics}
mkdir -p src/application/{dto,services,ports}
mkdir -p src/infrastructure/{supabase,cache,email,sms,storage,jobs,logging,queue}
mkdir -p src/presentation/components/{ui,storefront,admin}
mkdir -p src/presentation/{hooks,contexts}
mkdir -p supabase/{migrations,seed}
mkdir -p tests/{unit,integration,e2e}

# Route groups - storefront pages
mkdir -p 'src/app/(storefront)/products'
mkdir -p 'src/app/(storefront)/products/[slug]'
mkdir -p 'src/app/(storefront)/cart'
mkdir -p 'src/app/(storefront)/checkout'
mkdir -p 'src/app/(storefront)/checkout/success'
mkdir -p 'src/app/(storefront)/account'
mkdir -p 'src/app/(storefront)/account/orders'
mkdir -p 'src/app/(storefront)/account/orders/[id]'
mkdir -p 'src/app/(storefront)/account/addresses'
mkdir -p 'src/app/(storefront)/wishlist'
mkdir -p 'src/app/(storefront)/categories'
mkdir -p 'src/app/(storefront)/categories/[slug]'
mkdir -p 'src/app/(storefront)/search'

# Admin pages
mkdir -p 'src/app/admin/layout'
mkdir -p 'src/app/admin/dashboard'
mkdir -p 'src/app/admin/products'
mkdir -p 'src/app/admin/products/new'
mkdir -p 'src/app/admin/products/[id]'
mkdir -p 'src/app/admin/orders'
mkdir -p 'src/app/admin/orders/[id]'
mkdir -p 'src/app/admin/customers'
mkdir -p 'src/app/admin/customers/[id]'
mkdir -p 'src/app/admin/inventory'
mkdir -p 'src/app/admin/coupons'
mkdir -p 'src/app/admin/coupons/new'
mkdir -p 'src/app/admin/settings'
mkdir -p 'src/app/admin/settings/delivery'
mkdir -p 'src/app/admin/settings/payments'
mkdir -p 'src/app/admin/analytics'
mkdir -p 'src/app/admin/activity'

# Route groups - owner pages
mkdir -p 'src/app/(owner)/dashboard'
mkdir -p 'src/app/(owner)/analytics'
mkdir -p 'src/app/(owner)/reports'
mkdir -p 'src/app/(owner)/stores'
mkdir -p 'src/app/(owner)/users'
mkdir -p 'src/app/(owner)/settings'

# API routes - products
mkdir -p src/app/api/v1/products
mkdir -p 'src/app/api/v1/products/[id]'
mkdir -p src/app/api/v1/products/featured
mkdir -p src/app/api/v1/products/search
mkdir -p src/app/api/v1/products/bulk

# API routes - categories
mkdir -p src/app/api/v1/categories
mkdir -p 'src/app/api/v1/categories/[id]'

# API routes - orders
mkdir -p src/app/api/v1/orders
mkdir -p 'src/app/api/v1/orders/[id]'
mkdir -p 'src/app/api/v1/orders/[id]/items'
mkdir -p 'src/app/api/v1/orders/[id]/notes'
mkdir -p 'src/app/api/v1/orders/[id]/refund'

# API routes - cart
mkdir -p src/app/api/v1/cart
mkdir -p src/app/api/v1/cart/items
mkdir -p 'src/app/api/v1/cart/items/[id]'
mkdir -p src/app/api/v1/cart/checkout
mkdir -p src/app/api/v1/cart/coupon

# API routes - auth
mkdir -p src/app/api/v1/auth/register
mkdir -p src/app/api/v1/auth/login
mkdir -p src/app/api/v1/auth/logout
mkdir -p src/app/api/v1/auth/refresh
mkdir -p src/app/api/v1/auth/forgot-password
mkdir -p src/app/api/v1/auth/reset-password
mkdir -p src/app/api/v1/auth/verify-email
mkdir -p src/app/api/v1/auth/me

# API routes - users
mkdir -p src/app/api/v1/users
mkdir -p 'src/app/api/v1/users/[id]'
mkdir -p src/app/api/v1/users/me
mkdir -p src/app/api/v1/users/me/addresses
mkdir -p src/app/api/v1/users/me/orders
mkdir -p src/app/api/v1/users/me/wishlist

# API routes - inventory
mkdir -p src/app/api/v1/inventory
mkdir -p 'src/app/api/v1/inventory/[id]'
mkdir -p src/app/api/v1/inventory/low-stock
mkdir -p src/app/api/v1/inventory/logs

# API routes - coupons
mkdir -p src/app/api/v1/coupons
mkdir -p 'src/app/api/v1/coupons/[id]'
mkdir -p src/app/api/v1/coupons/validate

# API routes - delivery
mkdir -p src/app/api/v1/delivery/zones
mkdir -p 'src/app/api/v1/delivery/zones/[id]'
mkdir -p src/app/api/v1/delivery/slots
mkdir -p src/app/api/v1/delivery/calculate

# API routes - notifications
mkdir -p src/app/api/v1/notifications
mkdir -p 'src/app/api/v1/notifications/[id]'

# API routes - admin
mkdir -p src/app/api/v1/admin/dashboard
mkdir -p src/app/api/v1/admin/users
mkdir -p 'src/app/api/v1/admin/users/[id]'
mkdir -p src/app/api/v1/admin/activity
mkdir -p src/app/api/v1/admin/fraud

# API routes - analytics
mkdir -p src/app/api/v1/analytics/sales
mkdir -p src/app/api/v1/analytics/products
mkdir -p src/app/api/v1/analytics/customers
mkdir -p src/app/api/v1/analytics/funnel
mkdir -p src/app/api/v1/analytics/export

# API routes - webhooks
mkdir -p src/app/api/v1/webhooks/payment
mkdir -p src/app/api/v1/webhooks/delivery
mkdir -p src/app/api/v1/webhooks/sms

# API routes - storage
mkdir -p src/app/api/v1/storage/upload
mkdir -p src/app/api/v1/storage/signed-url

# API routes - health
mkdir -p src/app/api/health

echo "✅ Directory structure created!"
echo ""

# 2. Move files from src/app to proper locations
echo "📦 Organizing source files..."

if [ -f "src/app/entities.ts" ]; then
  cp src/app/entities.ts src/domain/entities/index.ts
  echo "  ✓ Moved domain entities"
fi

if [ -f "src/app/supabase.ts" ]; then
  cp src/app/supabase.ts src/infrastructure/supabase/client.ts
  echo "  ✓ Moved Supabase client"
fi

if [ -f "src/app/database.types.ts" ]; then
  cp src/app/database.types.ts src/infrastructure/supabase/database.types.ts
  echo "  ✓ Moved database types"
fi

if [ -f "src/app/api-utils.ts" ]; then
  cp src/app/api-utils.ts src/lib/api-utils.ts
  echo "  ✓ Moved API utilities"
fi

if [ -f "src/app/schemas.ts" ]; then
  cp src/app/schemas.ts src/lib/schemas.ts
  echo "  ✓ Moved validation schemas"
fi

# Create lib/supabase/server.ts
mkdir -p src/lib/supabase
cat > src/lib/supabase/server.ts << 'SERVEREOF'
import { createServerClient as createClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClient() {
  const cookieStore = await cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export async function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
SERVEREOF
echo "  ✓ Created lib/supabase/server.ts"

# Create lib/supabase/client.ts
cat > src/lib/supabase/client.ts << 'CLIENTEOF'
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
CLIENTEOF
echo "  ✓ Created lib/supabase/client.ts"

# Copy schemas
if [ -f "src/app/schemas.ts" ]; then
  cp src/app/schemas.ts src/lib/schemas.ts
  echo "  ✓ Copied schemas to lib"
fi

# Copy api-utils
if [ -f "src/app/api-utils.ts" ]; then
  cp src/app/api-utils.ts src/lib/api-utils.ts
  echo "  ✓ Copied api-utils to lib"
fi

echo ""

# 3. Install dependencies
echo "📦 Installing production dependencies..."
npm install @supabase/supabase-js@latest @supabase/ssr@latest zod uuid bcryptjs jsonwebtoken date-fns slugify ioredis nodemailer

echo ""
echo "📦 Installing dev dependencies..."
npm install -D @types/bcryptjs @types/jsonwebtoken @types/uuid @types/nodemailer vitest @testing-library/react @testing-library/jest-dom

echo ""
echo "📝 Creating API route files..."

# Products API route
cat > src/app/api/v1/products/route.ts << 'EOF'
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse, paginatedResponse, withAuth } from '@/lib/api-utils';
import { productSchema } from '@/lib/schemas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');

    const supabase = await createServerClient();
    const offset = (page - 1) * limit;

    let query = supabase.from('products').select('*, category:categories(id, name, slug), variations:product_variations(*)', { count: 'exact' }).eq('is_active', true);

    if (search) query = query.or('name.ilike.%' + search + '%,description.ilike.%' + search + '%');
    if (featured === 'true') query = query.eq('is_featured', true);
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;
    if (error) return errorResponse('Failed to fetch products', 500);
    return paginatedResponse(products || [], { page, limit, total: count || 0 });
  } catch (error) {
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    if (user.role !== 'admin' && user.role !== 'owner') return errorResponse('Forbidden', 403);
    try {
      const body = await req.json();
      const validation = productSchema.safeParse(body);
      if (!validation.success) return errorResponse('Validation failed', 400, validation.error.errors);

      const supabase = await createServerClient();
      const { data: product, error } = await supabase.from('products').insert(validation.data).select().single();
      if (error) return errorResponse('Failed to create product', 500);
      return jsonResponse(product, 201);
    } catch (error) {
      return errorResponse('Internal server error', 500);
    }
  });
}
EOF
echo "  - Created products route"

# Categories API route
cat > src/app/api/v1/categories/route.ts << 'EOF'
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: categories, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    if (error) return errorResponse('Failed to fetch categories', 500);
    return jsonResponse(categories || []);
  } catch (error) {
    return errorResponse('Internal server error', 500);
  }
}
EOF
echo "  - Created categories route"

# Cart API route
cat > src/app/api/v1/cart/route.ts << 'EOF'
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse, withAuth } from '@/lib/api-utils';
import { z } from 'zod';

const addToCartSchema = z.object({
  product_id: z.string().uuid(),
  variation_id: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(100),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const supabase = await createServerClient();
      const { data: cart, error } = await supabase.from('carts').select('*, items:cart_items(*, product:products(id, name, slug, images, base_price))').eq('user_id', user.id).eq('status', 'active').single();
      if (error && error.code === 'PGRST116') {
        const { data: newCart } = await supabase.from('carts').insert({ user_id: user.id, status: 'active' }).select().single();
        return jsonResponse({ ...newCart, items: [] });
      }
      if (error) return errorResponse('Failed to fetch cart', 500);
      return jsonResponse(cart);
    } catch (error) {
      return errorResponse('Internal server error', 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const validation = addToCartSchema.safeParse(body);
      if (!validation.success) return errorResponse('Validation failed', 400, validation.error.errors);

      const { product_id, variation_id, quantity } = validation.data;
      const supabase = await createServerClient();

      const { data: product } = await supabase.from('products').select('id, base_price').eq('id', product_id).eq('is_active', true).single();
      if (!product) return errorResponse('Product not found', 404);

      let { data: cart } = await supabase.from('carts').select('id').eq('user_id', user.id).eq('status', 'active').single();
      if (!cart) {
        const { data: newCart } = await supabase.from('carts').insert({ user_id: user.id, status: 'active' }).select('id').single();
        cart = newCart;
      }

      const { data: cartItem, error } = await supabase.from('cart_items').insert({ cart_id: cart!.id, product_id, variation_id, quantity, price: product.base_price }).select().single();
      if (error) return errorResponse('Failed to add to cart', 500);
      return jsonResponse(cartItem, 201);
    } catch (error) {
      return errorResponse('Internal server error', 500);
    }
  });
}
EOF
echo "  - Created cart route"

# Health check API
cat > src/app/api/health/route.ts << 'EOF'
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
EOF
echo "  - Created health route"

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "  1. Copy environment file:"
echo "     cp .env.local.example .env.local"
echo ""
echo "  2. Fill in your Supabase credentials in .env.local:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "     - SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "  3. Apply database migrations:"
echo "     npx supabase db push (or apply manually in Supabase dashboard)"
echo ""
echo "  4. Start development server:"
echo "     npm run dev"
echo ""
echo "  5. Open in browser:"
echo "     http://localhost:3000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
