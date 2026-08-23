-- ============================================================================
-- SMSTech ENTERPRISE FEATURES MIGRATION (015_complete_enterprise_features.sql)
-- Multi-Branch, Serialized Hardware, POS Shifts, Party Ledgers, Pre-Bookings, & Payments
-- ============================================================================

-- 1. Extend Customers Table with Enterprise Fields
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS nfc_card_uid TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'Silver' CHECK (loyalty_tier IN ('Silver', 'Gold', 'Platinum', 'VIP')),
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS advance_balance DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS outstanding_due DECIMAL(12,2) DEFAULT 0.00;

-- Auto-generate customer_code if missing
UPDATE customers 
SET customer_code = 'CUST-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))
WHERE customer_code IS NULL;

-- 2. Ensure Default Multi-Branch Warehouses
INSERT INTO warehouses (name, code, address, is_active, is_default)
VALUES 
  ('Multiplan Branch', 'BRANCH-01', 'Shop 309, Level-3, Computer City Center (Multiplan), Elephant Road, Dhaka', true, true),
  ('Banani Branch', 'BRANCH-02', 'Road 11, Block D, Banani, Dhaka', true, false),
  ('IDB Bhaban Branch', 'BRANCH-03', 'BCS Computer City, IDB Bhaban, Agargaon, Dhaka', true, false),
  ('Uttara Branch', 'BRANCH-04', 'Sector 3, Uttara Commercial Area, Dhaka', true, false),
  ('Chattogram Branch', 'BRANCH-05', 'GEC Circle, Central Plaza, Chattogram', true, false)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, address = EXCLUDED.address, is_active = true;

-- 3. Serialized Hardware Device Units (Pillar 2)
CREATE TABLE IF NOT EXISTS device_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    serial_number TEXT UNIQUE NOT NULL,
    imei_1 TEXT,
    imei_2 TEXT,
    mac_address TEXT,
    battery_health_pct INT CHECK (battery_health_pct >= 0 AND battery_health_pct <= 100),
    battery_cycles INT DEFAULT 0,
    cosmetic_grade TEXT DEFAULT 'Brand New' CHECK (cosmetic_grade IN ('Brand New', 'Like New A+', 'Grade A', 'Grade B')),
    regional_variant TEXT DEFAULT 'Official' CHECK (regional_variant IN ('Official', 'US', 'LL', 'ZA', 'JP', 'HK', 'Global', 'Other')),
    specs_summary JSONB DEFAULT '{}'::jsonb,
    cost_price DECIMAL(10,2) DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'sold', 'in_transit', 'defective', 'returned')),
    sold_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    sold_at TIMESTAMPTZ,
    warranty_months INT DEFAULT 12,
    warranty_expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_units_product ON device_units(product_id);
CREATE INDEX IF NOT EXISTS idx_device_units_serial ON device_units(serial_number);
CREATE INDEX IF NOT EXISTS idx_device_units_imei1 ON device_units(imei_1);
CREATE INDEX IF NOT EXISTS idx_device_units_warehouse ON device_units(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_device_units_status ON device_units(status);

-- 4. Inter-Branch Stock Transfers (Pillar 2)
CREATE TABLE IF NOT EXISTS branch_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT UNIQUE NOT NULL,
    source_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'rejected')),
    total_items INT DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES branch_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    device_unit_id UUID REFERENCES device_units(id) ON DELETE SET NULL,
    quantity INT DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. POS Cash Shifts & Drawer Reconciliation (Pillar 1)
CREATE TABLE IF NOT EXISTS pos_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_number TEXT UNIQUE NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    cashier_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    opening_float DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    closing_cash_actual DECIMAL(10,2),
    closing_cash_expected DECIMAL(10,2),
    cash_sales_total DECIMAL(10,2) DEFAULT 0.00,
    card_sales_total DECIMAL(10,2) DEFAULT 0.00,
    mobile_sales_total DECIMAL(10,2) DEFAULT 0.00,
    wallet_sales_total DECIMAL(10,2) DEFAULT 0.00,
    dues_created_total DECIMAL(10,2) DEFAULT 0.00,
    dues_collected_total DECIMAL(10,2) DEFAULT 0.00,
    difference DECIMAL(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'drop', 'float_adjustment')),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Double-Entry Party Accounting Ledger (Pillar 4)
CREATE TABLE IF NOT EXISTS party_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
    party_id UUID NOT NULL,
    party_name TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    balance_after DECIMAL(12,2) NOT NULL,
    reference_type TEXT NOT NULL CHECK (reference_type IN ('sales_invoice', 'purchase_bill', 'payment_received', 'payment_made', 'refund', 'advance_deposit', 'due_clearance', 'adjustment')),
    reference_id TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_ledgers_party ON party_ledgers(party_id, party_type);
CREATE INDEX IF NOT EXISTS idx_party_ledgers_created ON party_ledgers(created_at);

-- 7. Storefront Pre-Booking Engine (Pillar 6)
CREATE TABLE IF NOT EXISTS pre_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    target_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    queue_priority INT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    advance_paid DECIMAL(10,2) NOT NULL,
    remaining_due DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'bkash',
    payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'allocated', 'ready_for_pickup', 'fulfilled', 'cancelled')),
    allocated_unit_id UUID REFERENCES device_units(id) ON DELETE SET NULL,
    allocated_at TIMESTAMPTZ,
    fulfilled_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_bookings_queue ON pre_bookings(product_id, queue_priority);

-- 8. Split Payment Transactions & Gateway Logs (Pillars 1 & 7)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    pre_booking_id UUID REFERENCES pre_bookings(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES pos_shifts(id) ON DELETE SET NULL,
    gateway TEXT NOT NULL CHECK (gateway IN ('cash', 'card', 'bkash', 'nagad', 'sslcommerz', 'customer_advance', 'customer_due')),
    transaction_reference TEXT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('initiated', 'completed', 'failed', 'refunded')),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Add Serialized Items & Split Payment Tracking to Orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES pos_shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'storefront' CHECK (invoice_type IN ('storefront', 'pos', 'b2b_wholesale', 'pre_booking')),
ADD COLUMN IF NOT EXISTS advance_deducted DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS due_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_breakdown JSONB DEFAULT '[]'::jsonb;

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS device_unit_id UUID REFERENCES device_units(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS imei_1 TEXT,
ADD COLUMN IF NOT EXISTS warranty_period TEXT;

-- 10. Enable RLS
ALTER TABLE device_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read device_units" ON device_units FOR SELECT USING (true);
CREATE POLICY "Public read branch_transfers" ON branch_transfers FOR SELECT USING (true);
CREATE POLICY "Public read pos_shifts" ON pos_shifts FOR SELECT USING (true);
CREATE POLICY "Public read party_ledgers" ON party_ledgers FOR SELECT USING (true);
CREATE POLICY "Public read pre_bookings" ON pre_bookings FOR SELECT USING (true);
CREATE POLICY "Public insert pre_bookings" ON pre_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read payment_transactions" ON payment_transactions FOR SELECT USING (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
