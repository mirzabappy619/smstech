# SMSTech Admin Panel Architecture & Workflow Guide

This document serves as the single source of truth for the SMSTech Admin Panel, navigation hierarchy, UI/UX architecture, mobile design patterns, and operational workflows.

---

## 1. Navigation Menu Hierarchy (Usage-Based)

The admin panel navigation is organized into 6 usage-oriented groups in `src/app/admin/admin-layout-client.tsx`:

### 1. Daily Operations (Highest Frequency)
- **Dashboard** (`/admin/dashboard`) — Executive revenue, COGS, gross margin, dues, branch view.
- **Shop POS Terminal** (`/admin/pos`) — *[Badge: Live]* Shift opening/closing, customer lookup (NFC), item search, split payment (Cash/Card/MFS/Due), thermal printing.
- **Store Orders** (`/admin/orders`) — Live order management, fraud risk lookup, status transitions, manual order creation modal.
- **Pre-Bookings** (`/admin/pre-bookings`) — 10% advance pre-orders, auto-allocation of stock.

### 2. Catalog & Inventory (Product & Stock Management)
- **Products Catalog** (`/admin/products`) — List, search, category filter, bulk delete, direct storefront preview links (`/product/[slug]`).
- **Categories** (`/admin/categories`) — Category hierarchy, metadata, sort order.
- **Stock Levels** (`/admin/inventory`) — Available vs reserved stock, quick stock adjustment modal, inventory activity logs.
- **Warehouse Stock** (`/admin/inventory/warehouse`) — Multi-warehouse inventory breakdown.
- **Serialized Hardware** (`/admin/inventory/serialized`) — IMEI, serial numbers, battery health, cosmetic grading (A+, A, B).
- **Branch Transfers** (`/admin/inventory/transfers`) — Inter-branch item dispatch, transit tracking, receiving.
- **Batch Buy / Sell** (`/admin/inventory/procurement`) — Bulk vendor procurement, client batch dispatch.
- **QR / Barcode Labels** (`/admin/labels`) — Printable thermal QR/barcodes for serialized hardware.

### 3. Logistics & Risk (Fulfillment & Safety)
- **Courier Logistics** (`/admin/courier`) — Pathao & Steadfast API integration, parcel creation, tracking, status sync.
- **Fraud Check** (`/admin/fraud-check`) — 12oClock API delivery rate check, BD phone validation, risk score badge.

### 4. Customers & Finance (Relationships & Ledger)
- **Customers & Party** (`/admin/customers`) — Customer profiles, password resets, account locking, fraud flags.
- **Accounting Ledger** (`/admin/accounting/ledger`) — Double-entry customer/vendor ledgers, due collection.
- **Analytics & Reports** (`/admin/analytics`) — Revenue charts, category breakdown, top products.

### 5. Marketing & Growth (Promotions)
- **Hero Sliders** (`/admin/sliders`) — Homepage slider banner management.
- **Coupons & Discounts** (`/admin/coupons`) — Percentage & fixed discounts, minimum cart value, usage limits.
- **Landing Pages** (`/admin/landing-pages`) — Visual drag-and-drop landing page builder (`/admin/landing-pages/builder`).

### 6. Administration & System (Access & Settings)
- **Staff & Branches** (`/admin/users`) — Staff accounts, role assignments, branch scoping.
- **Roles & Permissions** (`/admin/roles`) — RBAC matrix configuration.
- **Store Settings** (`/admin/settings`) — Store identity, contact details, payment methods, delivery charges.
- **Meta Pixel (CAPI)** (`/admin/meta-pixel`) — Conversions API tracking & test events.
- **Google Analytics** (`/admin/google-analytics`) — GA4 Measurement ID and event routing.

---

## 2. Key UI/UX & Mobile Responsiveness Enhancements

1. **Responsive Dual-View Architecture**:
   - **Desktop (`≥ 768px / md:`)**: Clean data tables with sticky headers, quick action buttons, status pills, and checkbox selection.
   - **Mobile (`< 768px`)**: Stacked summary cards with thumb-friendly touch targets, action bars, formatted pricing, and collapsible details.
2. **Fixed Storefront Links**:
   - Storefront links correctly resolve to `/product/[slug]` (previously pointed to `/products/[slug]`).
3. **Enhanced Normalization Layer (`src/data/products.ts`)**:
   - `normalizeProduct()` automatically supports database fields (`base_price`, `compare_at_price`, `original_price`, `attributes.brand`, `product_variations`).
4. **Accounting Route Redirection**:
   - Added `/admin/accounting/page.tsx` redirecting to `/admin/accounting/ledger`.

---

## 3. Core Admin User Workflows & Testing

### Workflow A: Add a Product & View on Store
1. Navigate to `/admin/products/new` (or `POST /api/v1/products`).
2. Fill basic info: Name, SKU, Base Price, Compare Price, Category, Images.
3. Add variations if applicable (e.g., Storage, RAM, Color).
4. Product is persisted in Supabase `products` and `product_variations`.
5. Frontend retrieves product via `/api/v1/products` or `/api/v1/products/[slug]`.
6. Storefront renders product card and detail page at `/product/[slug]`.

### Workflow B: Order Processing & Fraud Check
1. Customer places order on storefront (`/checkout`) or Admin creates order manually (`/admin/orders`).
2. Order appears in `/admin/orders` with phone number and fraud risk button.
3. Clicking 🛡️ Risk runs phone check against 12oClock API (`/api/v1/fraud-check?phone=01XXXXXXXXX`).
4. Admin confirms order and dispatches via Pathao/Steadfast in `/admin/courier`.

### Workflow C: POS Shift & Inventory Adjustment
1. Cashier opens shift in `/admin/pos`.
2. Adds items to cart, applies customer NFC card or phone lookup.
3. Completes payment (Cash, Card, MFS, or Due).
4. System automatically decrements available stock and creates log in `/admin/inventory`.
5. Cashier prints 80mm/58mm thermal receipt at `/admin/pos/thermal-receipt/[id]`.

---

## 4. Continuity Checklist for AI Agents & Developers

- **Typecheck**: `npx tsc --noEmit`
- **Unit Tests**: `npx vitest run tests/unit/`
- **Build**: `npm run build`
- **Navigation File**: `src/app/admin/admin-layout-client.tsx`
- **Store Normalizer**: `src/data/products.ts`
- **Phone & Fraud Lib**: `src/lib/bd-phone-validator.ts`, `src/lib/fraud-check.ts`
