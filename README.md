# E-Commerce Monolith

A production-ready, enterprise-grade e-commerce system built as a Next.js monolith with Supabase backend.

## Features

### Core Modules
- **Product Management** - Products with variations, SKU, SEO metadata, media upload
- **Inventory** - Multi-location stock, stock logs, low stock alerts
- **Orders** - Full lifecycle, split shipment, partial refund, PDF invoices
- **Abandoned Cart** - Detection, email recovery, auto-coupons
- **Users** - Auth, profiles, addresses, wishlist, order history
- **Admin** - Role-based access control (RBAC), activity logs
- **Notifications** - Email, SMS, push notifications
- **Delivery** - Zones, slots, driver assignment, tracking
- **Analytics** - Sales, products, customers, reports
- **Fraud Detection** - Velocity rules, IP tracking, auto-blocking

### Technical Features
- Next.js 16 with App Router
- TypeScript strict mode
- Clean Architecture + DDD
- Supabase (Postgres, Auth, Storage)
- RBAC with JWT
- Rate limiting
- Background jobs
- Audit logging

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)

### Installation

```bash
# 1. Run setup script
bash setup.sh

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Apply database migrations
# Go to Supabase SQL Editor and run:
# - supabase-migration.sql (creates tables)
# - supabase-seed.sql (sample data)

# 4. Start development
npm run dev
```

Open http://localhost:3000 to see the storefront.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous key | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | Yes |

See `.env.local.example` for all options.

## API Routes

### Auth
- POST /api/v1/auth/register - Register user
- POST /api/v1/auth/login - Login
- POST /api/v1/auth/logout - Logout

### Products
- GET /api/v1/products - List products
- GET /api/v1/products/[id] - Get product
- POST /api/v1/products - Create (admin)
- PUT /api/v1/products/[id] - Update (admin)

### Orders
- GET /api/v1/orders - List orders
- POST /api/v1/orders - Create order
- PUT /api/v1/orders/[id] - Update (admin)

### Cart
- GET /api/v1/cart - Get cart
- POST /api/v1/cart/items - Add item
- PUT /api/v1/cart/items/[id] - Update item
- DELETE /api/v1/cart/items/[id] - Remove item

## Scripts

| Script | Description |
|--------|-------------|
| npm run dev | Start development server |
| npm run build | Build for production |
| npm run start | Start production server |
| npm run lint | Run ESLint |
| npm test | Run tests |

## Deployment (Vercel)

1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy!

```bash
vercel deploy --prod
```

## License

MIT License
