#!/usr/bin/env node
/**
 * Demo data loader for the admin panel.
 *
 *   node scripts/seed-demo-data.mjs
 *
 * Fills the operational sections that ship empty — staff, customers, branch
 * inventory, serialized units, orders, pre-bookings, ledgers, marketing — with
 * a consistent Dhaka-based dataset. Every row uses a fixed UUID and is
 * upserted, so re-running refreshes the demo set instead of duplicating it.
 *
 * Writes to whatever project .env.local points at, using the service role key.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// ── env ─────────────────────────────────────────────────────────────────────
const envPath = fs.existsSync(".env.local") ? ".env.local" : ".env";
const env = Object.fromEntries(
	fs
		.readFileSync(envPath, "utf8")
		.split("\n")
		.filter((l) => l.includes("=") && !l.trim().startsWith("#"))
		.map((l) => {
			const i = l.indexOf("=");
			return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
		}),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let failed = 0;
async function upsert(table, rows, onConflict = "id") {
	const { error } = await sb.from(table).upsert(rows, { onConflict });
	if (error) {
		failed++;
		console.log(`  \x1b[31m✗\x1b[0m ${table.padEnd(24)} ${error.message}`);
	} else {
		console.log(`  \x1b[32m✓\x1b[0m ${table.padEnd(24)} ${rows.length} rows`);
	}
}

// ── time helpers (store runs on Asia/Dhaka) ─────────────────────────────────
const HOUR = 3600_000;
const ago = (days, hour = 12) => {
	const d = new Date(Date.now() - days * 24 * HOUR);
	d.setUTCHours(hour - 6, 15, 0, 0); // hour, expressed store-local
	return d.toISOString();
};

// ── existing reference rows ─────────────────────────────────────────────────
const W = {
	MULTIPLAN: "2df85163-d0d9-42a0-84cf-cc1256cfe3df",
	BANANI: "fe9d7d72-3019-490a-9183-8c2f5bf192bb",
	IDB: "556699a5-d854-4992-af10-e700357cf04f",
	UTTARA: "523575ef-b926-4025-8b52-584b542b03b7",
	CTG: "f80bcb51-63f0-4e9c-a58d-5aef36f0836b",
};

const P = {
	ROG: "b1000000-0000-0000-0000-000000000002",
	MBA15M3: "b1000000-0000-0000-0000-000000000003",
	IP17P: "b1000000-0000-0000-0000-000000000004",
	S26U: "b1000000-0000-0000-0000-000000000005",
	DELL3410: "b1000000-0000-0000-0000-000000000006",
	HP445G7: "b1000000-0000-0000-0000-000000000007",
	HP840G8: "b1000000-0000-0000-0000-000000000008",
	SURFACE4: "b1000000-0000-0000-0000-000000000009",
	HP445G9: "b1000000-0000-0000-0000-000000000010",
	HP640G9: "b1000000-0000-0000-0000-000000000011",
	HP830G8: "b1000000-0000-0000-0000-000000000012",
	MBAM1: "b1000000-0000-0000-0000-000000000001",
	MBPM1: "2528b250-5bb8-4898-9d87-eae25d690fcf",
	MBAM2: "846b8438-2fca-409a-946a-aa842daf0bf7",
	MBPM2: "7f48b6b0-f972-4450-9259-a31ff38fdb04",
	MBAM3: "1bbc36a1-b65b-4db1-8239-8ce3ec8c72f4",
};

const V = {
	MBAM1_256: "e1000000-0000-0000-0000-000000000001",
	MBAM1_512: "e1000000-0000-0000-0000-000000000002",
	MBPM1_256: "8abb58aa-7cbc-41dc-aa9e-ad3d3570922c",
	MBAM2_256: "78ff31d7-952f-41f7-9ca7-9272d39daeb6",
	MBPM2_256: "c5f02ac1-0533-4306-acb7-14ccee44b53c",
	MBAM3_256: "d5c89248-e7ed-47e1-8ad6-e2723c254ff0",
};

const OPEN_SHIFT = "8b0b95cc-bd60-415a-9004-b611fcdb694c";

// ── 1. staff ────────────────────────────────────────────────────────────────
// users.role still carries the original CHECK (customer/admin/owner/staff) on
// databases without migration 025, so the granular RBAC key is probed once and
// the intended role is always kept in metadata either way.
const STAFF = [
	{ id: "f1000000-0000-0000-0000-000000000001", full_name: "Rashedul Karim", email: "rashedul.karim@smstechbd.com", phone: "+8801711000101", role: "admin", branches: "all", designation: "Head of Operations" },
	{ id: "f1000000-0000-0000-0000-000000000002", full_name: "Nusrat Jahan", email: "nusrat.jahan@smstechbd.com", phone: "+8801711000102", role: "branch_manager", branches: [W.MULTIPLAN], designation: "Branch Manager — Multiplan" },
	{ id: "f1000000-0000-0000-0000-000000000003", full_name: "Tanvir Hasan", email: "tanvir.hasan@smstechbd.com", phone: "+8801711000103", role: "cashier", branches: [W.MULTIPLAN], designation: "Senior Cashier" },
	{ id: "f1000000-0000-0000-0000-000000000004", full_name: "Sadia Afrin", email: "sadia.afrin@smstechbd.com", phone: "+8801711000104", role: "cashier", branches: [W.BANANI], designation: "Cashier" },
	{ id: "f1000000-0000-0000-0000-000000000005", full_name: "Imran Chowdhury", email: "imran.chowdhury@smstechbd.com", phone: "+8801711000105", role: "inventory_manager", branches: [W.MULTIPLAN, W.IDB, W.UTTARA], designation: "Inventory Lead" },
	{ id: "f1000000-0000-0000-0000-000000000006", full_name: "Mahmudul Alam", email: "mahmudul.alam@smstechbd.com", phone: "+8801711000106", role: "accountant", branches: "all", designation: "Accounts Manager" },
	{ id: "f1000000-0000-0000-0000-000000000007", full_name: "Jubayer Rahman", email: "jubayer.rahman@smstechbd.com", phone: "+8801711000107", role: "delivery_agent", branches: [W.UTTARA], designation: "Delivery Rider" },
	{ id: "f1000000-0000-0000-0000-000000000008", full_name: "Farhana Islam", email: "farhana.islam@smstechbd.com", phone: "+8801711000108", role: "branch_manager", branches: [W.CTG], designation: "Branch Manager — Chattogram" },
];

const STAFF_IDS = Object.fromEntries(STAFF.map((s) => [s.full_name.split(" ")[0].toUpperCase(), s.id]));

// ── 2. customers ────────────────────────────────────────────────────────────
const CUSTOMERS = [
	{ n: 1, name: "Arif Mahmud", email: "arif.mahmud@gmail.com", phone: "+8801812345601", address: "House 42, Road 9/A, Dhanmondi", city: "Dhaka", postal: "1209", tier: "Gold", credit: 50000, advance: 0, due: 0, notes: "Repeat MacBook buyer. Prefers bKash." },
	{ n: 2, name: "Sumaiya Akter", email: "sumaiya.akter@gmail.com", phone: "+8801812345602", address: "Block C, Mirpur 10 Circle", city: "Dhaka", postal: "1216", tier: "Silver", credit: 0, advance: 0, due: 0, notes: null },
	{ n: 3, name: "Rakibul Hasan", email: "rakibul.hasan@yahoo.com", phone: "+8801812345603", address: "Sector 7, Road 12, Uttara", city: "Dhaka", postal: "1230", tier: "Platinum", credit: 100000, advance: 0, due: 15000, notes: "Corporate reseller — clears dues monthly." },
	{ n: 4, name: "Tahmina Rahman", email: "tahmina.rahman@gmail.com", phone: "+8801812345604", address: "Road 11, Block D, Banani", city: "Dhaka", postal: "1213", tier: "Silver", credit: 0, advance: 5000, due: 0, notes: "Advance kept against a future upgrade." },
	{ n: 5, name: "Shahriar Kabir", email: "shahriar.kabir@outlook.com", phone: "+8801812345605", address: "Plot 5, Gulshan Avenue, Gulshan 1", city: "Dhaka", postal: "1212", tier: "VIP", credit: 200000, advance: 0, due: 45000, notes: "B2B account — bulk laptop supply for office fit-outs." },
	{ n: 6, name: "Nazmul Huda", email: "nazmul.huda@gmail.com", phone: "+8801812345606", address: "GEC Circle, Nasirabad", city: "Chattogram", postal: "4000", tier: "Silver", credit: 0, advance: 0, due: 0, notes: null },
	{ n: 7, name: "Farzana Yesmin", email: "farzana.yesmin@gmail.com", phone: "+8801812345607", address: "Ring Road, Shyamoli, Mohammadpur", city: "Dhaka", postal: "1207", tier: "Gold", credit: 25000, advance: 0, due: 0, notes: null },
	{ n: 8, name: "Mizanur Rahman", email: "mizanur.rahman@gmail.com", phone: "+8801812345608", address: "BCS Computer City, Agargaon", city: "Dhaka", postal: "1207", tier: "Silver", credit: 0, advance: 0, due: 0, notes: null },
	{ n: 9, name: "Ayesha Siddika", email: "ayesha.siddika@gmail.com", phone: "+8801812345609", address: "Block J, Bashundhara R/A", city: "Dhaka", postal: "1229", tier: "Gold", credit: 0, advance: 20000, due: 0, notes: "Advance deposit held against iPhone 17 Pro pre-booking." },
	{ n: 10, name: "Habibur Rahman", email: "habib.rahman@gmail.com", phone: "+8801812345610", address: "Zindabazar Main Road", city: "Sylhet", postal: "3100", tier: "Silver", credit: 0, advance: 0, due: 0, notes: null },
];

const pad = (n) => String(n).padStart(2, "0");
const userId = (n) => `c1000000-0000-0000-0000-0000000000${pad(n)}`;
const custId = (n) => `c2000000-0000-0000-0000-0000000000${pad(n)}`;
const C = Object.fromEntries(CUSTOMERS.map((c) => [c.n, { ...c, userId: userId(c.n), custId: custId(c.n) }]));

// ── 3. branch inventory ─────────────────────────────────────────────────────
// [product, variation, warehouse, qty, reserved, reorder point, reorder qty, bin, counted days ago]
const INVENTORY = [
	[P.MBAM1, V.MBAM1_256, W.MULTIPLAN, 12, 2, 5, 20, "A-01-03", 6],
	[P.MBAM1, V.MBAM1_512, W.MULTIPLAN, 4, 0, 4, 10, "A-01-04", 6],
	[P.MBAM1, V.MBAM1_256, W.BANANI, 6, 1, 4, 12, "B-02-01", 9],
	[P.MBPM1, V.MBPM1_256, W.MULTIPLAN, 7, 0, 4, 10, "A-02-01", 6],
	[P.MBPM1, V.MBPM1_256, W.IDB, 3, 0, 4, 10, "C-01-02", 14],
	[P.MBAM2, V.MBAM2_256, W.MULTIPLAN, 9, 1, 5, 15, "A-02-05", 3],
	[P.MBAM2, V.MBAM2_256, W.UTTARA, 4, 0, 4, 10, "D-01-01", 11],
	[P.MBPM2, V.MBPM2_256, W.MULTIPLAN, 5, 0, 3, 8, "A-03-02", 3],
	[P.MBAM3, V.MBAM3_256, W.MULTIPLAN, 6, 1, 4, 12, "A-03-06", 2],
	[P.MBAM3, V.MBAM3_256, W.BANANI, 2, 0, 4, 12, "B-02-04", 8],
	[P.MBA15M3, null, W.MULTIPLAN, 5, 0, 3, 8, "A-04-01", 2],
	[P.MBA15M3, null, W.CTG, 2, 0, 3, 6, "E-01-02", 16],
	[P.IP17P, null, W.MULTIPLAN, 14, 4, 6, 25, "A-05-01", 1],
	[P.IP17P, null, W.BANANI, 8, 2, 5, 20, "B-03-01", 5],
	[P.IP17P, null, W.UTTARA, 3, 0, 5, 20, "D-02-01", 10],
	[P.S26U, null, W.MULTIPLAN, 11, 1, 5, 20, "A-05-04", 1],
	[P.S26U, null, W.CTG, 4, 0, 4, 12, "E-01-05", 16],
	[P.ROG, null, W.MULTIPLAN, 6, 1, 3, 8, "A-06-02", 4],
	[P.ROG, null, W.IDB, 2, 0, 3, 8, "C-02-01", 13],
	[P.DELL3410, null, W.IDB, 9, 0, 4, 15, "C-03-01", 7],
	[P.DELL3410, null, W.CTG, 3, 0, 3, 10, "E-02-02", 16],
	[P.HP445G7, null, W.IDB, 11, 1, 5, 15, "C-03-04", 7],
	[P.HP445G7, null, W.BANANI, 5, 0, 4, 12, "B-04-01", 9],
	[P.HP840G8, null, W.IDB, 4, 0, 5, 15, "C-04-01", 7],
	[P.HP840G8, null, W.UTTARA, 2, 1, 4, 12, "D-03-02", 12],
	[P.SURFACE4, null, W.IDB, 3, 0, 3, 8, "C-04-05", 15],
	[P.HP445G9, null, W.MULTIPLAN, 8, 0, 4, 12, "A-07-01", 4],
	[P.HP445G9, null, W.UTTARA, 0, 0, 4, 12, "D-03-05", 12],
	[P.HP640G9, null, W.MULTIPLAN, 7, 2, 4, 12, "A-07-04", 4],
	[P.HP640G9, null, W.CTG, 0, 0, 3, 10, "E-03-01", 16],
	[P.HP830G8, null, W.MULTIPLAN, 10, 0, 5, 15, "A-08-01", 4],
	[P.HP830G8, null, W.IDB, 5, 1, 4, 12, "C-05-02", 13],
];

const invId = (i) => `11000000-0000-0000-0000-0000000000${pad(i + 1)}`;

// ── 4. orders ───────────────────────────────────────────────────────────────
const ordId = (n) => `01000000-0000-0000-0000-0000000000${pad(n)}`;

const ORDERS = [
	{
		n: 1, number: "ORD-MG5K2A1-7XQD", cust: 1, status: "delivered", payment_status: "paid",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "bkash",
		shipping: 0, discount: 0, days: 29, ship_method: "Store Pickup",
		items: [{ p: P.MBAM3, v: V.MBAM3_256, name: 'Apple MacBook Air M3 (8GB / 256GB)', vname: "8GB / 256GB SSD", price: 95000, qty: 1 }],
	},
	{
		n: 2, number: "ORD-MG6P3B2-2LMN", cust: 2, status: "delivered", payment_status: "paid",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "bkash",
		shipping: 60, discount: 5000, days: 21, coupon: "EIDSALE", ship_method: "Inside Dhaka Delivery",
		items: [{ p: P.IP17P, v: null, name: "iPhone 17 Pro", vname: null, price: 179999, qty: 1 }],
	},
	{
		n: 3, number: "POS-40218873", cust: 3, status: "delivered", payment_status: "partially_paid",
		source: "pos", invoice_type: "pos", warehouse: W.MULTIPLAN, method: "cash",
		shipping: 0, discount: 0, days: 15, due: 15000, ship_method: "Store Pickup",
		items: [
			{ p: P.HP840G8, v: null, name: "HP EliteBook 840 G8 (i5-11th / 16GB / 512GB)", vname: null, price: 52500, qty: 1 },
			{ p: P.HP445G9, v: null, name: "HP ProBook 445 G9 (Ryzen 5 / 16GB / 512GB)", vname: null, price: 56000, qty: 1 },
		],
	},
	{
		n: 4, number: "ORD-MG7Q4C3-9ZRT", cust: 4, status: "shipped", payment_status: "paid",
		source: "web", invoice_type: "storefront", warehouse: W.BANANI, method: "card",
		shipping: 60, discount: 0, days: 3, ship_method: "Inside Dhaka Delivery",
		courier: { provider: "pathao", consignment: "PTH-8842119", code: "DH8842119BD", status: "in_transit", fee: 60, sentDays: 3 },
		items: [{ p: P.S26U, v: null, name: "Galaxy S26 Ultra", vname: null, price: 174999, qty: 1 }],
	},
	{
		n: 5, number: "ORD-MG7R5D4-1AWS", cust: 5, status: "delivered", payment_status: "partially_paid",
		source: "web", invoice_type: "b2b_wholesale", warehouse: W.MULTIPLAN, method: "bank_transfer",
		shipping: 0, discount: 2500, days: 4, due: 45000, ship_method: "Store Pickup",
		items: [
			{ p: P.MBPM2, v: V.MBPM2_256, name: "Apple MacBook Pro M2 (8GB / 256GB)", vname: "8GB / 256GB SSD", price: 83500, qty: 1 },
			{ p: P.MBAM1, v: V.MBAM1_256, name: "Apple MacBook Air M1 (8GB / 256GB)", vname: "8GB / 256GB SSD", price: 59000, qty: 1 },
		],
	},
	{
		n: 6, number: "POS-40219102", cust: 6, status: "delivered", payment_status: "paid",
		source: "pos", invoice_type: "pos", warehouse: W.CTG, method: "cash",
		shipping: 0, discount: 0, days: 2, ship_method: "Store Pickup",
		items: [{ p: P.DELL3410, v: null, name: 'Dell Latitude 3410 14"', vname: null, price: 38500, qty: 1 }],
	},
	{
		n: 7, number: "ORD-MG7T6E5-3EDC", cust: 7, status: "processing", payment_status: "paid",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "nagad",
		shipping: 60, discount: 0, days: 1, ship_method: "Inside Dhaka Delivery",
		items: [{ p: P.MBAM2, v: V.MBAM2_256, name: "Apple MacBook Air M2 (8GB / 256GB)", vname: "8GB / 256GB SSD", price: 81000, qty: 1 }],
	},
	{
		n: 8, number: "ORD-MG7U7F6-5RFV", cust: 8, status: "pending", payment_status: "pending",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "cash_on_delivery",
		shipping: 60, discount: 0, days: 0, ship_method: "Inside Dhaka Delivery",
		items: [{ p: P.HP640G9, v: null, name: "HP ProBook 640 G9 (i5-12th / 16GB / 512GB)", vname: null, price: 62000, qty: 1 }],
	},
	{
		n: 9, number: "ORD-MG7V8G7-7TGB", cust: 9, status: "shipped", payment_status: "paid",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "bkash",
		shipping: 60, discount: 0, days: 5, ship_method: "Inside Dhaka Delivery",
		courier: { provider: "steadfast", consignment: "SF-5510923", code: "SFD5510923", status: "picked_up", fee: 60, sentDays: 5 },
		items: [{ p: P.MBAM1, v: V.MBAM1_512, name: "Apple MacBook Air M1 (8GB / 256GB)", vname: "8GB / 512GB SSD", price: 114999, qty: 1 }],
	},
	{
		n: 10, number: "ORD-MG7W9H8-9YHN", cust: 10, status: "pending", payment_status: "pending",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "cash_on_delivery",
		shipping: 120, discount: 0, days: 0, ship_method: "Outside Dhaka Delivery",
		items: [{ p: P.ROG, v: null, name: "ASUS ROG Strix G16 Gaming Laptop", vname: null, price: 189999, qty: 1 }],
	},
	{
		n: 11, number: "ORD-MG6X1I9-0UJM", cust: 1, status: "cancelled", payment_status: "pending",
		source: "web", invoice_type: "storefront", warehouse: W.MULTIPLAN, method: "cash_on_delivery",
		shipping: 60, discount: 0, days: 8, ship_method: "Inside Dhaka Delivery",
		notes: "Customer cancelled — found a better bundle offer elsewhere.",
		items: [{ p: P.IP17P, v: null, name: "iPhone 17 Pro", vname: null, price: 179999, qty: 1 }],
	},
	{
		n: 12, number: "ORD-MG6Y2J0-2IKL", cust: 2, status: "refunded", payment_status: "refunded",
		source: "web", invoice_type: "storefront", warehouse: W.IDB, method: "card",
		shipping: 60, discount: 0, days: 11, ship_method: "Inside Dhaka Delivery",
		notes: "Returned within 7 days — keyboard backlight fault. Refunded to card.",
		items: [{ p: P.SURFACE4, v: null, name: "Microsoft Surface Laptop 4 (i7-11th / 16GB / 512GB)", vname: null, price: 68000, qty: 1 }],
	},
	{
		n: 13, number: "POS-40219288", cust: 5, status: "delivered", payment_status: "paid",
		source: "pos", invoice_type: "pos", warehouse: W.BANANI, method: "card", shift: OPEN_SHIFT,
		shipping: 0, discount: 0, days: 1, ship_method: "Store Pickup",
		items: [{ p: P.MBPM1, v: V.MBPM1_256, name: "Apple MacBook Pro M1 (8GB / 256GB)", vname: "8GB / 256GB SSD", price: 66000, qty: 1 }],
	},
	{
		n: 14, number: "POS-40219340", cust: 7, status: "delivered", payment_status: "paid",
		source: "pos", invoice_type: "pos", warehouse: W.BANANI, method: "cash", shift: OPEN_SHIFT,
		shipping: 0, discount: 0, days: 0, ship_method: "Store Pickup",
		items: [{ p: P.HP445G7, v: null, name: "HP ProBook 445 G7 (Ryzen 5 / 8GB / 256GB)", vname: null, price: 42000, qty: 1 }],
	},
	{
		n: 15, number: "ORD-MG7P0K1-6PLO", cust: 3, status: "delivered", payment_status: "paid",
		source: "pos", invoice_type: "pre_booking", warehouse: W.MULTIPLAN, method: "bkash",
		shipping: 0, discount: 0, days: 6, advance: 25000, ship_method: "Store Pickup",
		notes: "Pre-booking PRE-100004 fulfilled at counter. Advance adjusted against invoice.",
		items: [{ p: P.IP17P, v: null, name: "iPhone 17 Pro", vname: null, price: 179999, qty: 1 }],
	},
];

// ── 5. serialized device units ──────────────────────────────────────────────
// [n, product, variation, warehouse, serial, imei1, grade, variant, cost, sell, status, soldOrder, warrantyMonths, battery]
const DEVICE_UNITS = [
	[1, P.MBAM3, V.MBAM3_256, W.MULTIPLAN, "C02MBAM3D01", null, "Brand New", "Official", 86500, 95000, "sold", 1, 12, 100],
	[2, P.MBAM3, V.MBAM3_256, W.MULTIPLAN, "C02MBAM3D02", null, "Brand New", "Official", 86500, 95000, "in_stock", null, 12, 100],
	[3, P.MBAM2, V.MBAM2_256, W.MULTIPLAN, "C02MBAM2D01", null, "Brand New", "Official", 73200, 81000, "reserved", null, 12, 100],
	[4, P.MBAM1, V.MBAM1_512, W.MULTIPLAN, "C02MBAM1D01", null, "Like New A+", "LL", 101500, 114999, "sold", 9, 6, 94],
	[5, P.MBAM1, V.MBAM1_256, W.MULTIPLAN, "C02MBAM1D02", null, "Grade A", "US", 51000, 59000, "sold", 5, 6, 88],
	[6, P.MBPM2, V.MBPM2_256, W.MULTIPLAN, "C02MBPM2D01", null, "Brand New", "Official", 75800, 83500, "sold", 5, 12, 100],
	[7, P.MBPM1, V.MBPM1_256, W.BANANI, "C02MBPM1D01", null, "Like New A+", "LL", 58900, 66000, "sold", 13, 6, 91],
	[8, P.IP17P, null, W.MULTIPLAN, "F2LIP17P001", "356938035643801", "Brand New", "Official", 163000, 179999, "sold", 2, 12, 100],
	[9, P.IP17P, null, W.MULTIPLAN, "F2LIP17P002", "356938035643802", "Brand New", "Official", 163000, 179999, "sold", 15, 12, 100],
	[10, P.IP17P, null, W.MULTIPLAN, "F2LIP17P003", "356938035643803", "Brand New", "Official", 163000, 179999, "reserved", null, 12, 100],
	[11, P.IP17P, null, W.BANANI, "F2LIP17P004", "356938035643804", "Brand New", "ZA", 159500, 176000, "in_stock", null, 12, 100],
	[12, P.S26U, null, W.BANANI, "R58S26U0001", "351234567890121", "Brand New", "Official", 158000, 174999, "sold", 4, 12, 100],
	[13, P.S26U, null, W.MULTIPLAN, "R58S26U0002", "351234567890122", "Brand New", "Official", 158000, 174999, "in_stock", null, 12, 100],
	[14, P.DELL3410, null, W.CTG, "DL3410CTG001", null, "Grade A", "Other", 32000, 38500, "sold", 6, 3, null],
	[15, P.DELL3410, null, W.IDB, "DL3410IDB002", null, "Grade B", "Other", 30500, 36000, "defective", null, 3, null],
	[16, P.HP840G8, null, W.IDB, "HP840G8IDB01", null, "Grade A", "Other", 45000, 52500, "sold", 3, 6, null],
	[17, P.HP445G9, null, W.MULTIPLAN, "HP445G9MP001", null, "Like New A+", "Other", 48500, 56000, "sold", 3, 6, null],
	[18, P.HP445G7, null, W.BANANI, "HP445G7BN001", null, "Grade A", "Other", 35800, 42000, "sold", 14, 6, null],
	[19, P.HP830G8, null, W.IDB, "HP830G8IDB01", null, "Grade A", "Other", 50000, 58500, "in_transit", null, 6, null],
	[20, P.SURFACE4, null, W.IDB, "SFL4IDB00001", null, "Grade A", "Other", 59000, 68000, "returned", null, 6, null],
];

const duId = (n) => `d1000000-0000-0000-0000-0000000000${pad(n)}`;

// ── 6. pre-bookings ─────────────────────────────────────────────────────────
const PRE_BOOKINGS = [
	{ n: 1, number: "PRE-100001", cust: 9, product: P.IP17P, variation: null, warehouse: W.MULTIPLAN, priority: 1, price: 179999, advance: 20000, method: "bkash", status: "allocated", unit: 10, days: 12 },
	{ n: 2, number: "PRE-100002", cust: 2, product: P.IP17P, variation: null, warehouse: W.MULTIPLAN, priority: 2, price: 179999, advance: 18000, method: "nagad", status: "queued", unit: null, days: 9 },
	{ n: 3, number: "PRE-100003", cust: 8, product: P.IP17P, variation: null, warehouse: W.BANANI, priority: 3, price: 179999, advance: 18000, method: "card", status: "queued", unit: null, days: 5 },
	{ n: 4, number: "PRE-100004", cust: 3, product: P.IP17P, variation: null, warehouse: W.MULTIPLAN, priority: 4, price: 179999, advance: 25000, method: "bkash", status: "fulfilled", unit: 9, order: 15, days: 18 },
	{ n: 5, number: "PRE-100005", cust: 4, product: P.S26U, variation: null, warehouse: W.MULTIPLAN, priority: 1, price: 174999, advance: 17500, method: "bkash", status: "queued", unit: null, days: 7 },
	{ n: 6, number: "PRE-100006", cust: 7, product: P.MBAM2, variation: V.MBAM2_256, warehouse: W.MULTIPLAN, priority: 1, price: 81000, advance: 30000, method: "bank_transfer", status: "ready_for_pickup", unit: 3, days: 10 },
	{ n: 7, number: "PRE-100007", cust: 10, product: P.MBA15M3, variation: null, warehouse: W.CTG, priority: 1, price: 179999, advance: 20000, method: "cash", status: "queued", unit: null, days: 2 },
	{ n: 8, number: "PRE-100008", cust: 6, product: P.ROG, variation: null, warehouse: W.CTG, priority: 1, price: 189999, advance: 19000, method: "bkash", status: "cancelled", unit: null, days: 20 },
];

// ── suppliers (party ledger only — there is no suppliers table) ─────────────
const SUPPLIERS = [
	{ id: "51000000-0000-0000-0000-000000000001", name: "Smart Technologies (BD) Ltd." },
	{ id: "51000000-0000-0000-0000-000000000002", name: "Global Brand Pvt. Ltd." },
	{ id: "51000000-0000-0000-0000-000000000003", name: "Ryans Computers Wholesale" },
];

// ════════════════════════════════════════════════════════════════════════════
async function main() {
	console.log(`\n\x1b[1mSeeding demo data → ${env.NEXT_PUBLIC_SUPABASE_URL}\x1b[0m\n`);

	// Does users.role still carry the original four-value CHECK?
	const probeId = "00000000-0000-4000-8000-00000000ffff";
	const { error: probeError } = await sb
		.from("users")
		.insert({ id: probeId, email: "role-probe@smstechbd.invalid", full_name: "Role Probe", role: "branch_manager" });
	const granularRoles = !probeError;
	if (probeError && !/users_role_check/.test(probeError.message)) {
		console.log(`  \x1b[31m✗\x1b[0m role probe failed: ${probeError.message}`);
	}
	await sb.from("users").delete().eq("id", probeId);
	if (!granularRoles) {
		console.log(
			"  \x1b[33m!\x1b[0m users.role CHECK still allows only customer/admin/owner/staff.\n" +
			"    Staff are seeded as 'staff' with the intended RBAC role kept in metadata.\n" +
			"    Apply supabase/migrations/025_users_role_rbac_keys.sql, then re-run to promote them.\n",
		);
	}

	// 1. staff + customer user accounts
	await upsert("users", [
		...STAFF.map((s) => ({
			id: s.id,
			email: s.email,
			full_name: s.full_name,
			phone: s.phone,
			role: granularRoles ? s.role : s.role === "admin" ? "admin" : "staff",
			is_active: true,
			is_all_branches: s.branches === "all",
			default_branch_id: s.branches === "all" ? null : s.branches[0],
			metadata: { designation: s.designation, rbac_role: s.role, seeded: "demo" },
			created_at: ago(120),
			updated_at: ago(2),
		})),
		...CUSTOMERS.map((c) => ({
			id: userId(c.n),
			email: c.email,
			full_name: c.name,
			phone: c.phone,
			role: "customer",
			is_active: true,
			metadata: { fraud_status: c.n === 10 ? "suspicious" : "clean", seeded: "demo", ...(c.n === 10 ? { fraud_reason: "Two prior COD refusals reported by courier." } : {}) },
			created_at: ago(90 - c.n * 5),
			updated_at: ago(3),
		})),
	]);

	// 2. branch assignments
	await upsert(
		"user_branches",
		STAFF.flatMap((s, si) =>
			s.branches === "all"
				? []
				: s.branches.map((w, i) => ({
						id: `f2000000-0000-0000-0000-00000000${pad(si + 1)}${pad(i + 1)}`,
						user_id: s.id,
						warehouse_id: w,
						is_default: i === 0,
					})),
		),
		"user_id,warehouse_id",
	);

	// 3. customer records
	await upsert("customers", CUSTOMERS.map((c) => ({
		id: custId(c.n),
		user_id: userId(c.n),
		name: c.name,
		email: c.email,
		phone: c.phone,
		address_line1: c.address,
		city: c.city,
		postal_code: c.postal,
		country: "Bangladesh",
		customer_code: `CUST-${1000 + c.n}`,
		loyalty_tier: c.tier,
		credit_limit: c.credit,
		advance_balance: c.advance,
		outstanding_due: c.due,
		notes: c.notes,
		created_at: ago(90 - c.n * 5),
		updated_at: ago(3),
	})));

	await upsert("addresses", CUSTOMERS.slice(0, 6).map((c) => ({
		id: `c3000000-0000-0000-0000-0000000000${pad(c.n)}`,
		user_id: userId(c.n),
		label: "Home",
		street: c.address,
		city: c.city,
		state: c.city === "Dhaka" ? "Dhaka" : c.city === "Chattogram" ? "Chattogram" : "Sylhet",
		postal_code: c.postal,
		country: "Bangladesh",
		phone: c.phone,
		is_default: true,
	})));

	// 4. inventory
	await upsert("inventory", INVENTORY.map(([p, v, w, qty, res, rp, rq, bin, counted], i) => ({
		id: invId(i),
		warehouse_id: w,
		product_id: p,
		variation_id: v,
		quantity: qty,
		reserved_quantity: res,
		reorder_point: rp,
		reorder_quantity: rq,
		bin_location: bin,
		last_counted_at: ago(counted),
		updated_at: ago(counted),
	})));

	// 5. orders
	const orderRows = ORDERS.map((o) => {
		const cust = C[o.cust];
		const subtotal = o.items.reduce((s, it) => s + it.price * it.qty, 0);
		const advance = o.advance || 0;
		const total = subtotal + o.shipping - o.discount - advance;
		return {
			id: ordId(o.n),
			order_number: o.number,
			customer_id: cust.custId,
			customer_name: cust.name,
			customer_phone: cust.phone,
			customer_email: cust.email,
			address_line1: cust.address,
			city: cust.city,
			shipping_method: o.ship_method,
			shipping_amount: o.shipping,
			discount_amount: o.discount,
			subtotal,
			tax_amount: 0,
			total,
			currency: "BDT",
			coupon_code: o.coupon || null,
			payment_method: o.method,
			payment_status: o.payment_status,
			status: o.status,
			source: o.source,
			invoice_type: o.invoice_type,
			warehouse_id: o.warehouse,
			shift_id: o.shift || null,
			advance_deducted: advance,
			due_amount: o.due || 0,
			payment_breakdown: o.due
				? { paid: total - o.due, due: o.due, method: o.method }
				: { paid: total, method: o.method },
			shipping_address: {
				name: cust.name, phone: cust.phone,
				address_line1: cust.address, city: cust.city,
				postal_code: cust.postal, country: "Bangladesh",
			},
			notes: o.notes || null,
			created_at: ago(o.days, 11 + (o.n % 8)),
			updated_at: ago(Math.max(0, o.days - 1), 15),
		};
	});
	await upsert("orders", orderRows);

	// 6. serialized units (sold ones point back at their order)
	await upsert("device_units", DEVICE_UNITS.map(([n, p, v, w, serial, imei, grade, variant, cost, sell, status, soldOrder, warranty, battery]) => {
		const soldOn = soldOrder ? ORDERS.find((o) => o.n === soldOrder) : null;
		return {
			id: duId(n),
			product_id: p,
			variation_id: v,
			warehouse_id: w,
			serial_number: serial,
			imei_1: imei,
			battery_health_pct: battery,
			battery_cycles: battery ? Math.round((100 - battery) * 14) : 0,
			cosmetic_grade: grade,
			regional_variant: variant,
			cost_price: cost,
			selling_price: sell,
			status,
			sold_order_id: soldOrder ? ordId(soldOrder) : null,
			sold_at: soldOn ? ago(soldOn.days, 13) : null,
			warranty_months: warranty,
			warranty_expires_at: soldOn ? ago(soldOn.days - warranty * 30, 13) : null,
			notes: status === "defective" ? "Hinge play and dead pixel column — pulled from sale floor." : null,
			created_at: ago(60),
			updated_at: ago(1),
		};
	}));

	// 7. order items (serialized lines carry their unit)
	const unitForOrder = new Map();
	DEVICE_UNITS.filter((d) => d[11]).forEach((d) => {
		const key = `${d[11]}:${d[1]}`;
		if (!unitForOrder.has(key)) unitForOrder.set(key, d);
	});

	let itemSeq = 0;
	const itemRows = ORDERS.flatMap((o) =>
		o.items.map((it) => {
			itemSeq++;
			const unit = unitForOrder.get(`${o.n}:${it.p}`);
			return {
				id: `02000000-0000-0000-0000-0000000000${pad(itemSeq)}`,
				order_id: ordId(o.n),
				product_id: it.p,
				variation_id: it.v,
				product_name: it.name,
				variation_name: it.vname,
				unit_price: it.price,
				quantity: it.qty,
				total: it.price * it.qty,
				device_unit_id: unit ? duId(unit[0]) : null,
				serial_number: unit ? unit[4] : null,
				imei_1: unit ? unit[5] : null,
				warranty_period: unit ? `${unit[12]} months` : null,
				created_at: ago(o.days, 11 + (o.n % 8)),
			};
		}),
	);
	await upsert("order_items", itemRows);

	// 8. pre-bookings
	await upsert("pre_bookings", PRE_BOOKINGS.map((b) => {
		const cust = C[b.cust];
		return {
			id: `03000000-0000-0000-0000-0000000000${pad(b.n)}`,
			booking_number: b.number,
			customer_id: cust.custId,
			customer_name: cust.name,
			customer_phone: cust.phone,
			customer_email: cust.email,
			product_id: b.product,
			variation_id: b.variation,
			target_warehouse_id: b.warehouse,
			queue_priority: b.priority,
			total_price: b.price,
			advance_paid: b.advance,
			remaining_due: b.status === "fulfilled" ? 0 : b.price - b.advance,
			payment_method: b.method,
			payment_status: b.status === "cancelled" ? "refunded" : "paid",
			status: b.status,
			allocated_unit_id: b.unit ? duId(b.unit) : null,
			allocated_at: b.unit ? ago(Math.max(0, b.days - 4), 10) : null,
			fulfilled_order_id: b.order ? ordId(b.order) : null,
			created_at: ago(b.days, 10),
			updated_at: ago(Math.max(0, b.days - 4), 10),
		};
	}));

	// 9. order paper trail
	//    payment_transactions only models the supported gateways (cash, card,
	//    bkash, nagad, sslcommerz, advances, dues), so the two bank transfers
	//    are recorded in the party ledger rather than here.
	await upsert("order_notes", [
		{ id: "0d000000-0000-0000-0000-000000000001", order_id: ordId(3), user_id: STAFF_IDS.TANVIR, note: "৳15,000 left on account. Customer agreed to clear by the 10th.", is_internal: true, created_at: ago(15, 16) },
		{ id: "0d000000-0000-0000-0000-000000000002", order_id: ordId(4), user_id: STAFF_IDS.NUSRAT, note: "Handed to Pathao rider at 4:20 PM. Fragile sticker applied.", is_internal: true, created_at: ago(3, 16) },
		{ id: "0d000000-0000-0000-0000-000000000003", order_id: ordId(5), user_id: STAFF_IDS.MAHMUDUL, note: "B2B invoice raised against the Gulshan office fit-out PO. 45k on 15-day credit.", is_internal: true, created_at: ago(4, 14) },
		{ id: "0d000000-0000-0000-0000-000000000004", order_id: ordId(11), user_id: STAFF_IDS.RASHEDUL, note: "Cancelled before dispatch — no stock movement, reservation released.", is_internal: true, created_at: ago(8, 12) },
		{ id: "0d000000-0000-0000-0000-000000000005", order_id: ordId(12), user_id: STAFF_IDS.IMRAN, note: "Unit received back at IDB, marked returned pending vendor RMA.", is_internal: true, created_at: ago(10, 11) },
		{ id: "0d000000-0000-0000-0000-000000000006", order_id: ordId(9), user_id: STAFF_IDS.JUBAYER, note: "Customer asked for delivery after 5 PM.", is_internal: false, created_at: ago(5, 18) },
	]);

	await upsert("order_tracking_events", [
		{ id: "0e000000-0000-0000-0000-000000000001", order_id: ordId(4), provider: "pathao", status: "pickup_requested", status_detail: "Pickup requested from Banani Branch", location: "Banani, Dhaka", timestamp: ago(3, 15) },
		{ id: "0e000000-0000-0000-0000-000000000002", order_id: ordId(4), provider: "pathao", status: "picked_up", status_detail: "Parcel collected by rider", location: "Banani, Dhaka", timestamp: ago(3, 17) },
		{ id: "0e000000-0000-0000-0000-000000000003", order_id: ordId(4), provider: "pathao", status: "in_transit", status_detail: "At Tejgaon sorting hub", location: "Tejgaon, Dhaka", timestamp: ago(2, 9) },
		{ id: "0e000000-0000-0000-0000-000000000004", order_id: ordId(9), provider: "steadfast", status: "picked_up", status_detail: "Parcel collected from Multiplan Branch", location: "Elephant Road, Dhaka", timestamp: ago(5, 16) },
		{ id: "0e000000-0000-0000-0000-000000000005", order_id: ordId(2), provider: "pathao", status: "delivered", status_detail: "Delivered and payment settled", location: "Mirpur, Dhaka", timestamp: ago(20, 13) },
	]);

	await upsert("payment_transactions", [
		{ id: "0c000000-0000-0000-0000-000000000001", order_id: ordId(1), gateway: "bkash", transaction_reference: "BKH8H2K91LP", amount: 95000, status: "completed", created_at: ago(29, 12) },
		{ id: "0c000000-0000-0000-0000-000000000002", order_id: ordId(2), gateway: "bkash", transaction_reference: "BKH9M4T20QA", amount: 175059, status: "completed", created_at: ago(21, 12) },
		{ id: "0c000000-0000-0000-0000-000000000003", order_id: ordId(3), gateway: "cash", transaction_reference: "POS-CASH-40218873", amount: 93500, status: "completed", created_at: ago(15, 16) },
		{ id: "0c000000-0000-0000-0000-000000000004", order_id: ordId(4), gateway: "card", transaction_reference: "VISA-4021-8891", amount: 175059, status: "completed", created_at: ago(3, 14) },
		{ id: "0c000000-0000-0000-0000-000000000006", order_id: ordId(12), gateway: "card", transaction_reference: "VISA-3390-1182-RFND", amount: 68060, status: "refunded", created_at: ago(10, 12) },
		{ id: "0c000000-0000-0000-0000-000000000007", pre_booking_id: "03000000-0000-0000-0000-000000000001", gateway: "bkash", transaction_reference: "BKH1P8W55ZC", amount: 20000, status: "completed", created_at: ago(12, 10) },
		{ id: "0c000000-0000-0000-0000-000000000009", order_id: ordId(13), shift_id: OPEN_SHIFT, gateway: "card", transaction_reference: "MC-7781-0043", amount: 66000, status: "completed", created_at: ago(1, 15) },
		{ id: "0c000000-0000-0000-0000-000000000010", order_id: ordId(14), shift_id: OPEN_SHIFT, gateway: "cash", transaction_reference: "POS-CASH-40219340", amount: 42000, status: "completed", created_at: ago(0, 11) },
	]);

	// 10. accounting ledger — customer dues/advances and supplier payables
	await upsert("party_ledgers", [
		{ id: "08000000-0000-0000-0000-000000000001", party_type: "customer", party_id: C[3].custId, party_name: C[3].name, entry_type: "debit", amount: 108500, balance_after: 108500, reference_type: "sales_invoice", reference_id: "POS-40218873", notes: "Two-unit counter sale", created_by: STAFF_IDS.TANVIR, created_at: ago(15, 16) },
		{ id: "08000000-0000-0000-0000-000000000002", party_type: "customer", party_id: C[3].custId, party_name: C[3].name, entry_type: "credit", amount: 93500, balance_after: 15000, reference_type: "payment_received", reference_id: "POS-40218873", notes: "Cash paid at counter", created_by: STAFF_IDS.TANVIR, created_at: ago(15, 16) },
		{ id: "08000000-0000-0000-0000-000000000003", party_type: "customer", party_id: C[5].custId, party_name: C[5].name, entry_type: "debit", amount: 140000, balance_after: 140000, reference_type: "sales_invoice", reference_id: "ORD-MG7R5D4-1AWS", notes: "B2B office fit-out invoice", created_by: STAFF_IDS.MAHMUDUL, created_at: ago(4, 12) },
		{ id: "08000000-0000-0000-0000-000000000004", party_type: "customer", party_id: C[5].custId, party_name: C[5].name, entry_type: "credit", amount: 95000, balance_after: 45000, reference_type: "payment_received", reference_id: "BRAC-TRF-771209", notes: "Bank transfer against invoice", created_by: STAFF_IDS.MAHMUDUL, created_at: ago(4, 13) },
		{ id: "08000000-0000-0000-0000-000000000005", party_type: "customer", party_id: C[9].custId, party_name: C[9].name, entry_type: "credit", amount: 20000, balance_after: 20000, reference_type: "advance_deposit", reference_id: "PRE-100001", notes: "iPhone 17 Pro pre-booking deposit", created_by: STAFF_IDS.TANVIR, created_at: ago(12, 10) },
		{ id: "08000000-0000-0000-0000-000000000006", party_type: "customer", party_id: C[4].custId, party_name: C[4].name, entry_type: "credit", amount: 5000, balance_after: 5000, reference_type: "advance_deposit", reference_id: "ADV-2026-0044", notes: "Advance held for upgrade", created_by: STAFF_IDS.SADIA, created_at: ago(7, 12) },
		{ id: "08000000-0000-0000-0000-000000000007", party_type: "supplier", party_id: SUPPLIERS[0].id, party_name: SUPPLIERS[0].name, entry_type: "credit", amount: 1305000, balance_after: 1305000, reference_type: "purchase_bill", reference_id: "PB-2026-0231", notes: "Apple batch — 15 units", created_by: STAFF_IDS.IMRAN, created_at: ago(24, 11) },
		{ id: "08000000-0000-0000-0000-000000000008", party_type: "supplier", party_id: SUPPLIERS[0].id, party_name: SUPPLIERS[0].name, entry_type: "debit", amount: 800000, balance_after: 505000, reference_type: "payment_made", reference_id: "CHQ-114290", notes: "Part payment by cheque", created_by: STAFF_IDS.MAHMUDUL, created_at: ago(12, 11) },
		{ id: "08000000-0000-0000-0000-000000000009", party_type: "supplier", party_id: SUPPLIERS[1].id, party_name: SUPPLIERS[1].name, entry_type: "credit", amount: 652000, balance_after: 652000, reference_type: "purchase_bill", reference_id: "PB-2026-0238", notes: "Samsung S26 Ultra batch", created_by: STAFF_IDS.IMRAN, created_at: ago(18, 11) },
		{ id: "08000000-0000-0000-0000-000000000010", party_type: "supplier", party_id: SUPPLIERS[2].id, party_name: SUPPLIERS[2].name, entry_type: "credit", amount: 288000, balance_after: 288000, reference_type: "purchase_bill", reference_id: "PB-2026-0245", notes: "Refurbished HP EliteBook lot", created_by: STAFF_IDS.IMRAN, created_at: ago(9, 11) },
	]);

	// 11. stock movement history
	await upsert("inventory_logs", [
		{ id: "09000000-0000-0000-0000-000000000001", inventory_id: invId(12), adjustment_type: "purchase", quantity_change: 19, quantity_before: 0, quantity_after: 19, reason: "Intake — PB-2026-0231 Apple batch", user_id: STAFF_IDS.IMRAN, created_at: ago(24, 11) },
		{ id: "09000000-0000-0000-0000-000000000002", inventory_id: invId(12), adjustment_type: "sale", quantity_change: -1, quantity_before: 19, quantity_after: 18, reason: "Order ORD-MG6P3B2-2LMN", order_id: ordId(2), user_id: STAFF_IDS.TANVIR, created_at: ago(21, 12) },
		{ id: "09000000-0000-0000-0000-000000000003", inventory_id: invId(12), adjustment_type: "sale", quantity_change: -1, quantity_before: 18, quantity_after: 17, reason: "Pre-booking fulfilment PRE-100004", order_id: ordId(15), user_id: STAFF_IDS.TANVIR, created_at: ago(6, 12) },
		{ id: "09000000-0000-0000-0000-000000000004", inventory_id: invId(12), adjustment_type: "transfer_out", quantity_change: -3, quantity_before: 17, quantity_after: 14, reason: "Transfer TRF-2026-0018 to Uttara", user_id: STAFF_IDS.IMRAN, created_at: ago(4, 10) },
		{ id: "09000000-0000-0000-0000-000000000005", inventory_id: invId(14), adjustment_type: "transfer_in", quantity_change: 3, quantity_before: 0, quantity_after: 3, reason: "Transfer TRF-2026-0018 received", user_id: STAFF_IDS.IMRAN, created_at: ago(3, 15) },
		{ id: "09000000-0000-0000-0000-000000000006", inventory_id: invId(0), adjustment_type: "sale", quantity_change: -1, quantity_before: 13, quantity_after: 12, reason: "Order ORD-MG7R5D4-1AWS", order_id: ordId(5), user_id: STAFF_IDS.TANVIR, created_at: ago(4, 12) },
		{ id: "09000000-0000-0000-0000-000000000007", inventory_id: invId(19), adjustment_type: "damage", quantity_change: -1, quantity_before: 10, quantity_after: 9, reason: "Hinge play and dead pixels — written off to RMA", user_id: STAFF_IDS.IMRAN, created_at: ago(13, 11) },
		{ id: "09000000-0000-0000-0000-000000000008", inventory_id: invId(25), adjustment_type: "return", quantity_change: 1, quantity_before: 2, quantity_after: 3, reason: "Refund ORD-MG6Y2J0-2IKL — unit back in stock", order_id: ordId(12), user_id: STAFF_IDS.IMRAN, created_at: ago(10, 11) },
		{ id: "09000000-0000-0000-0000-000000000009", inventory_id: invId(27), adjustment_type: "adjustment", quantity_change: -2, quantity_before: 2, quantity_after: 0, reason: "Cycle count correction at Uttara", user_id: STAFF_IDS.IMRAN, created_at: ago(12, 10) },
		{ id: "09000000-0000-0000-0000-000000000010", inventory_id: invId(21), adjustment_type: "purchase", quantity_change: 11, quantity_before: 0, quantity_after: 11, reason: "Intake — PB-2026-0245 refurbished lot", user_id: STAFF_IDS.IMRAN, created_at: ago(9, 11) },
	]);

	// 12. inter-branch transfers
	await upsert("branch_transfers", [
		{ id: "0a000000-0000-0000-0000-000000000001", transfer_number: "TRF-2026-0018", source_warehouse_id: W.MULTIPLAN, target_warehouse_id: W.UTTARA, status: "received", total_items: 3, notes: "Uttara counter ran dry on iPhone 17 Pro over the weekend.", created_by: STAFF_IDS.IMRAN, received_by: STAFF_IDS.JUBAYER, shipped_at: ago(4, 10), received_at: ago(3, 15), created_at: ago(4, 9) },
		{ id: "0a000000-0000-0000-0000-000000000002", transfer_number: "TRF-2026-0019", source_warehouse_id: W.IDB, target_warehouse_id: W.CTG, status: "in_transit", total_items: 2, notes: "Chattogram pre-owned display stock top-up.", created_by: STAFF_IDS.IMRAN, shipped_at: ago(1, 12), created_at: ago(1, 10) },
		{ id: "0a000000-0000-0000-0000-000000000003", transfer_number: "TRF-2026-0020", source_warehouse_id: W.MULTIPLAN, target_warehouse_id: W.BANANI, status: "pending", total_items: 2, notes: "Awaiting branch manager approval.", created_by: STAFF_IDS.NUSRAT, created_at: ago(0, 10) },
	]);

	await upsert("branch_transfer_items", [
		{ id: "0b000000-0000-0000-0000-000000000001", transfer_id: "0a000000-0000-0000-0000-000000000001", product_id: P.IP17P, quantity: 3 },
		{ id: "0b000000-0000-0000-0000-000000000002", transfer_id: "0a000000-0000-0000-0000-000000000002", product_id: P.HP830G8, device_unit_id: duId(19), quantity: 1 },
		{ id: "0b000000-0000-0000-0000-000000000003", transfer_id: "0a000000-0000-0000-0000-000000000002", product_id: P.DELL3410, quantity: 1 },
		{ id: "0b000000-0000-0000-0000-000000000004", transfer_id: "0a000000-0000-0000-0000-000000000003", product_id: P.MBAM3, quantity: 2 },
	]);

	// 13. POS drawer — the open Banani shift now has the two counter sales above
	await upsert("pos_shifts", [{
		id: OPEN_SHIFT,
		shift_number: "SHIFT-346372",
		warehouse_id: W.BANANI,
		cashier_user_id: STAFF_IDS.SADIA,
		opening_float: 5000,
		cash_sales_total: 42000,
		card_sales_total: 66000,
		mobile_sales_total: 0,
		wallet_sales_total: 0,
		dues_created_total: 0,
		dues_collected_total: 0,
		closing_cash_expected: 5000 + 42000 + 3000 - 10000,
		status: "open",
	}]);

	await upsert("pos_cash_movements", [
		{ id: "0f000000-0000-0000-0000-000000000001", shift_id: OPEN_SHIFT, type: "cash_in", amount: 3000, reason: "Due collection from walk-in customer", created_by: STAFF_IDS.SADIA, created_at: ago(0, 12) },
		{ id: "0f000000-0000-0000-0000-000000000002", shift_id: OPEN_SHIFT, type: "drop", amount: 10000, reason: "Mid-day drop to branch safe", created_by: STAFF_IDS.SADIA, created_at: ago(0, 14) },
	]);

	// 14. customer lifetime stats, straight off the seeded orders
	const earned = orderRows.filter((o) => !["cancelled", "refunded"].includes(o.status));
	await upsert("customers", CUSTOMERS.map((c) => {
		const mine = earned.filter((o) => o.customer_id === custId(c.n));
		return {
			id: custId(c.n),
			user_id: userId(c.n),
			name: c.name,
			total_orders: mine.length,
			total_spent: mine.reduce((s, o) => s + o.total, 0),
			updated_at: ago(0),
		};
	}));

	// 15. marketing
	await upsert("coupons", [
		{ id: "04000000-0000-0000-0000-000000000001", code: "EIDSALE", type: "percentage", value: 5, min_order_amount: 50000, max_discount_amount: 8000, max_uses: 500, uses_count: 63, starts_at: ago(40), expires_at: ago(-20), is_active: true },
		{ id: "04000000-0000-0000-0000-000000000002", code: "NEWYEAR2000", type: "fixed", value: 2000, min_order_amount: 40000, max_uses: 300, uses_count: 41, starts_at: ago(30), expires_at: ago(-35), is_active: true },
		{ id: "04000000-0000-0000-0000-000000000003", code: "FREEDELIVERY", type: "free_shipping", value: 0, min_order_amount: 25000, max_uses: null, uses_count: 128, starts_at: ago(60), expires_at: null, is_active: true },
		{ id: "04000000-0000-0000-0000-000000000004", code: "MACBOOK10", type: "percentage", value: 10, min_order_amount: 90000, max_discount_amount: 12000, max_uses: 100, uses_count: 12, starts_at: ago(10), expires_at: ago(-15), is_active: true },
		{ id: "04000000-0000-0000-0000-000000000005", code: "WINTERCLEAR", type: "fixed", value: 3500, min_order_amount: 35000, max_uses: 200, uses_count: 200, starts_at: ago(120), expires_at: ago(45), is_active: false },
	], "code");

	await upsert("hero_sliders", [
		{ id: "05000000-0000-0000-0000-000000000001", title: "iPhone 17 Pro — Now in Stock", subtitle: "Official warranty, all colours. Pre-book your unit with a 10% deposit.", badge: "NEW ARRIVAL", image_url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1600&h=700&fit=crop&auto=format", link_url: "/product/iphone-17-pro", button_text: "Pre-Book Now", sort_order: 1, is_active: true },
		{ id: "05000000-0000-0000-0000-000000000002", title: "MacBook Air M3 from ৳95,000", subtitle: "Genuine Apple stock across all five branches, with EMI from 12 months.", badge: "BEST SELLER", image_url: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=1600&h=700&fit=crop&auto=format", link_url: "/product/apple-macbook-air-m3-8-256", button_text: "Shop MacBooks", sort_order: 2, is_active: true },
		{ id: "05000000-0000-0000-0000-000000000003", title: "Certified Pre-Owned Laptops", subtitle: "Battery-tested, graded and warrantied business machines from ৳36,000.", badge: "VALUE PICK", image_url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1600&h=700&fit=crop&auto=format", link_url: "/laptops", button_text: "Browse Deals", sort_order: 3, is_active: true },
	]);

	await upsert("landing_pages", [
		{ id: "06000000-0000-0000-0000-000000000001", title: "iPhone 17 Pro Pre-Booking", slug: "iphone-17-pro-prebooking", status: "published", published_at: ago(12), created_at: ago(14), updated_at: ago(2) },
		{ id: "06000000-0000-0000-0000-000000000002", title: "Pre-Owned Business Laptop Mela", slug: "pre-owned-laptop-mela", status: "draft", created_at: ago(5), updated_at: ago(1) },
	]);

	await upsert("landing_page_blocks", [
		{
			id: "07000000-0000-0000-0000-000000000001", landing_page_id: "06000000-0000-0000-0000-000000000001", block_type: "hero", sort_order: 1,
			block_data: { title: "iPhone 17 Pro — Reserve Yours Today", subtitle: "Pay a 10% deposit, hold your place in the queue, and collect from any SMSTech branch the day stock lands.", ctaText: "Pre-Book Now", ctaLink: "#order", backgroundImage: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1600&h=900&fit=crop&auto=format", backgroundType: "image", textColor: "light" },
		},
		{
			id: "07000000-0000-0000-0000-000000000002", landing_page_id: "06000000-0000-0000-0000-000000000001", block_type: "features", sort_order: 2,
			block_data: { title: "Why pre-book with SMSTech", subtitle: "Queue position is locked the moment your deposit clears.", columns: 3, features: [
				{ icon: "🔢", title: "Transparent queue", description: "You get a numbered position and an SMS the moment a unit is allocated to you." },
				{ icon: "🛡️", title: "Official warranty", description: "Every unit is BTRC-registered with a full 12-month Apple service warranty." },
				{ icon: "↩️", title: "Refundable deposit", description: "Change your mind before allocation and the deposit comes straight back." },
			] },
		},
		{
			id: "07000000-0000-0000-0000-000000000003", landing_page_id: "06000000-0000-0000-0000-000000000001", block_type: "order_form", sort_order: 3,
			block_data: { title: "Reserve your iPhone 17 Pro", subtitle: "৳18,000 deposit. Balance due at collection.", showQuantity: false, requiredFields: ["firstName", "lastName", "phone", "address"], successMessage: "Pre-booking confirmed — we will SMS your queue number within an hour.", productOptions: [
				{ id: P.IP17P, name: "iPhone 17 Pro", price: 179999, description: "256GB, official warranty", image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=600&fit=crop&auto=format" },
			] },
		},
		{
			id: "07000000-0000-0000-0000-000000000004", landing_page_id: "06000000-0000-0000-0000-000000000001", block_type: "contact", sort_order: 4,
			block_data: { title: "Questions before you book?", phoneNumber: "+8809612345678", description: "Our Multiplan counter team answers 10 AM – 8 PM, Saturday to Thursday.", email: "support@smstechbd.com", showForm: false },
		},
		{
			id: "07000000-0000-0000-0000-000000000005", landing_page_id: "06000000-0000-0000-0000-000000000002", block_type: "hero", sort_order: 1,
			block_data: { title: "Pre-Owned Business Laptop Mela", subtitle: "Graded, battery-tested EliteBooks, ProBooks and Latitudes from ৳36,000 — six-month warranty included.", ctaText: "See the lineup", ctaLink: "#pricing", backgroundType: "gradient", backgroundColor: "#0f172a", textColor: "light" },
		},
		{
			id: "07000000-0000-0000-0000-000000000006", landing_page_id: "06000000-0000-0000-0000-000000000002", block_type: "why_us", sort_order: 2,
			block_data: { title: "Every unit is checked before it reaches the shelf", reasons: [
				{ icon: "🔋", title: "Battery health on the label", description: "We publish the measured battery health and cycle count for each machine." },
				{ icon: "🏷️", title: "Honest cosmetic grading", description: "Grade A, Grade B or Like New A+ — priced to match, with photos of the actual unit." },
				{ icon: "🧾", title: "Six-month warranty", description: "Service is handled in-house at Multiplan, IDB Bhaban and Chattogram." },
			] },
		},
	]);

	console.log(
		failed === 0
			? "\n\x1b[32mDone.\x1b[0m Demo data seeded.\n"
			: `\n\x1b[31m${failed} table(s) failed.\x1b[0m See the messages above.\n`,
	);
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
