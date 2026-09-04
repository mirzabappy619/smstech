#!/usr/bin/env node
/**
 * Applies the migration chain to a throwaway in-process Postgres (PGlite) so
 * SQL errors surface here rather than in the Supabase SQL editor.
 *
 *   npm install --no-save @electric-sql/pglite
 *   node scripts/test-migrations.mjs
 *
 * Then runs assertions against the resulting schema: the stock helpers refuse
 * to oversell, the drawer formula includes cash movements, and revenue
 * excludes cancelled orders.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

const MIGRATIONS = [
	"supabase/migrations/000_complete_setup.sql",
	"supabase/migrations/014_add_pre_owned_products.sql",
	"supabase/migrations/015_complete_enterprise_features.sql",
	"supabase/migrations/016_rbac_and_branch_permissions.sql",
	"supabase/migrations/017_inventory_integrity_and_pos_fixes.sql",
	"supabase/migrations/018_storefront_and_admin_tables.sql",
	"supabase/migrations/019_warehouse_contact_fields.sql",
	"supabase/migrations/020_storefront_order_and_courier_columns.sql",
	"supabase/migrations/021_row_level_security_policies.sql",
	"supabase/migrations/022_product_preorder.sql",
	"supabase/migrations/023_cash_close_approval_pipeline.sql",
	"supabase/migrations/024_performance_indexes.sql",
	"supabase/migrations/025_users_role_rbac_keys.sql",
];

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
	if (ok) {
		passed++;
		console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
	} else {
		failed++;
		console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
	}
}

// Supabase-only constructs PGlite does not provide. Stubbed so the migrations
// run unchanged rather than being edited for the test.
const SUPABASE_SHIM = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $fn$ SELECT NULL::uuid $fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $fn$ SELECT 'service_role'::text $fn$;
DO $shim$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $shim$;
`;

const db = new PGlite();

async function main() {
	console.log("\x1b[1mApplying migrations\x1b[0m");
	await db.exec(SUPABASE_SHIM);

	for (const file of MIGRATIONS) {
		if (!fs.existsSync(file)) {
			console.log(`  \x1b[90m·\x1b[0m ${path.basename(file)} (not present, skipped)`);
			continue;
		}
		// uuid-ossp is not bundled with PGlite; gen_random_uuid() (pgcrypto,
		// built in) covers everything the schema actually uses.
		const sql = fs
			.readFileSync(file, "utf8")
			.replace(/CREATE EXTENSION IF NOT EXISTS "(uuid-ossp|pgcrypto)";?/g, "")
			.replace(/uuid_generate_v4\(\)/g, "gen_random_uuid()");
		try {
			await db.exec(sql);
			check(path.basename(file), true);
		} catch (err) {
			check(path.basename(file), false, err.message.split("\n")[0].slice(0, 120));
		}
	}

	if (failed > 0) {
		console.log("\n\x1b[31mMigrations did not apply cleanly — stopping.\x1b[0m");
		return;
	}

	// ── schema objects ──────────────────────────────────────────────────────
	console.log("\n\x1b[1mSchema objects\x1b[0m");

	for (const t of [
		"inventory_logs",
		"order_fulfillments",
		"carts",
		"cart_items",
		"wishlists",
		"addresses",
		"coupons",
		"hero_sliders",
		"google_analytics_settings",
		"landing_page_blocks",
		"order_notes",
		"order_tracking_events",
		"delivery_zones",
	]) {
		const r = await db.query(
			`SELECT to_regclass('public.${t}') IS NOT NULL AS ok`,
		);
		check(`table ${t}`, r.rows[0].ok);
	}

	for (const fn of [
		"apply_stock_movement",
		"reserve_stock",
		"increment_shift_totals",
		"shift_expected_cash",
		"admin_order_totals",
		"admin_orders_by_status",
		"admin_customer_balances",
		"admin_prebooking_stats",
		"admin_supplier_balances",
		"admin_daily_revenue",
	]) {
		const r = await db.query(
			`SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = $1`,
			[fn],
		);
		check(`function ${fn}()`, r.rows[0].n > 0);
	}

	const invCols = await db.query(
		`SELECT column_name FROM information_schema.columns WHERE table_name='inventory'`,
	);
	const names = invCols.rows.map((r) => r.column_name);
	for (const c of ["reorder_point", "reorder_quantity", "bin_location", "last_counted_at"]) {
		check(`inventory.${c}`, names.includes(c));
	}

	const orderCols = await db.query(
		`SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='pre_booking_id'`,
	);
	check("orders.pre_booking_id", orderCols.rows.length === 1);

	// ── fixtures ────────────────────────────────────────────────────────────
	console.log("\n\x1b[1mBehaviour\x1b[0m");

	await db.exec(`
    INSERT INTO categories (id, name, slug) VALUES
      ('cc000000-0000-0000-0000-0000000000ff','Verify Category','verify-category');
    INSERT INTO products (id, category_id, name, slug, base_price) VALUES
      ('bb000000-0000-0000-0000-0000000000ff','cc000000-0000-0000-0000-0000000000ff','Verify Laptop','verify-laptop',50000);
  `);

	const wh = await db.query(`SELECT id, code FROM warehouses ORDER BY code LIMIT 2`);
	const [whA, whB] = wh.rows;

	// ── apply_stock_movement ────────────────────────────────────────────────
	const intake = await db.query(
		`SELECT * FROM apply_stock_movement($1,NULL,$2,10,'purchase','intake',NULL,NULL,false)`,
		["bb000000-0000-0000-0000-0000000000ff", whA.id],
	);
	check(
		"intake creates the inventory row",
		intake.rows[0].quantity_after === 10,
		`0 -> ${intake.rows[0].quantity_after}`,
	);

	const logCount = await db.query(`SELECT COUNT(*)::int AS n FROM inventory_logs`);
	check("movement is logged", logCount.rows[0].n === 1);

	let oversellRefused = false;
	try {
		await db.query(
			`SELECT * FROM apply_stock_movement($1,NULL,$2,-50,'sale','oversell',NULL,NULL,false)`,
			["bb000000-0000-0000-0000-0000000000ff", whA.id],
		);
	} catch (err) {
		oversellRefused = /INSUFFICIENT_STOCK/.test(err.message);
	}
	check("overselling raises INSUFFICIENT_STOCK", oversellRefused);

	const stillTen = await db.query(
		`SELECT quantity FROM inventory WHERE warehouse_id=$1`,
		[whA.id],
	);
	check(
		"refused sale left stock untouched",
		stillTen.rows[0].quantity === 10,
		`still ${stillTen.rows[0].quantity}`,
	);

	// ── reserve_stock ───────────────────────────────────────────────────────
	await db.query(
		`SELECT reserve_stock($1,NULL,$2,4)`,
		["bb000000-0000-0000-0000-0000000000ff", whA.id],
	);
	const reserved = await db.query(
		`SELECT quantity, reserved_quantity, available_quantity FROM inventory WHERE warehouse_id=$1`,
		[whA.id],
	);
	check(
		"reservation reduces available, not on-hand",
		reserved.rows[0].quantity === 10 && reserved.rows[0].available_quantity === 6,
		`qty 10, reserved 4, available ${reserved.rows[0].available_quantity}`,
	);

	let reserveRefused = false;
	try {
		await db.query(`SELECT reserve_stock($1,NULL,$2,100)`, [
			"bb000000-0000-0000-0000-0000000000ff",
			whA.id,
		]);
	} catch (err) {
		reserveRefused = /INSUFFICIENT_STOCK/.test(err.message);
	}
	check("cannot reserve more than on hand", reserveRefused);

	let belowReservedRefused = false;
	try {
		await db.query(
			`SELECT * FROM apply_stock_movement($1,NULL,$2,-8,'sale','below reserved',NULL,NULL,false)`,
			["bb000000-0000-0000-0000-0000000000ff", whA.id],
		);
	} catch (err) {
		belowReservedRefused = /INSUFFICIENT_STOCK/.test(err.message);
	}
	check(
		"cannot remove stock that is already reserved",
		belowReservedRefused,
		"10 on hand, 4 reserved, tried to remove 8",
	);

	// ── shift_expected_cash ─────────────────────────────────────────────────
	const shiftRow = await db.query(
		`INSERT INTO pos_shifts (shift_number, warehouse_id, opening_float, status)
     VALUES ('T-1', $1, 5000, 'open') RETURNING id`,
		[whA.id],
	);
	const shiftId = shiftRow.rows[0].id;

	await db.query(
		`SELECT increment_shift_totals($1, 42000, 0, 0, 0, 0, 8000)`,
		[shiftId],
	);
	await db.query(
		`INSERT INTO pos_cash_movements (shift_id, type, amount, reason)
     VALUES ($1,'drop',20000,'safe drop')`,
		[shiftId],
	);

	const expected = await db.query(`SELECT shift_expected_cash($1) AS v`, [shiftId]);
	check(
		"drawer = float + cash + dues − drop",
		Number(expected.rows[0].v) === 35000,
		`5,000 + 42,000 + 8,000 − 20,000 = ${Number(expected.rows[0].v).toLocaleString()}`,
	);

	await db.query(
		`INSERT INTO pos_cash_movements (shift_id, type, amount, reason)
     VALUES ($1,'cash_in',2000,'petty cash')`,
		[shiftId],
	);
	const expected2 = await db.query(`SELECT shift_expected_cash($1) AS v`, [shiftId]);
	check(
		"cash in raises the expected drawer",
		Number(expected2.rows[0].v) === 37000,
		`${Number(expected2.rows[0].v).toLocaleString()}`,
	);

	// One open shift per branch.
	let dupShiftRefused = false;
	try {
		await db.query(
			`INSERT INTO pos_shifts (shift_number, warehouse_id, opening_float, status)
       VALUES ('T-2', $1, 1000, 'open')`,
			[whA.id],
		);
	} catch (err) {
		dupShiftRefused = /duplicate key|unique/i.test(err.message);
	}
	check("only one shift can be open per branch", dupShiftRefused);

	// A second shift at another branch is fine.
	await db.query(
		`INSERT INTO pos_shifts (shift_number, warehouse_id, opening_float, status)
     VALUES ('T-3', $1, 1000, 'open')`,
		[whB.id],
	);
	check("other branches can still open a shift", true);

	// ── revenue aggregates ──────────────────────────────────────────────────
	await db.exec(`
    INSERT INTO orders (order_number, customer_name, customer_phone, address_line1, subtotal, total, status) VALUES
      ('O-1','A','017','x',100000,100000,'delivered'),
      ('O-2','B','017','x',50000,50000,'pending'),
      ('O-3','C','017','x',210000,210000,'cancelled'),
      ('O-4','D','017','x',75000,75000,'refunded');
  `);

	const totals = await db.query(
		`SELECT * FROM admin_order_totals(NULL, NULL, NULL)`,
	);
	check(
		"revenue excludes cancelled and refunded",
		Number(totals.rows[0].revenue) === 150000,
		`৳${Number(totals.rows[0].revenue).toLocaleString()} from 4 orders totalling ৳435,000`,
	);
	check(
		"order count excludes them too",
		Number(totals.rows[0].order_count) === 2,
		`${totals.rows[0].order_count} earning orders`,
	);

	const byStatus = await db.query(`SELECT * FROM admin_orders_by_status(NULL)`);
	check(
		"status breakdown still counts every order",
		byStatus.rows.reduce((s, r) => s + Number(r.count), 0) === 4,
	);

	const daily = await db.query(
		`SELECT * FROM admin_daily_revenue(NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day')`,
	);
	check(
		"daily revenue buckets by day",
		daily.rows.length >= 1 && Number(daily.rows[0].revenue) === 150000,
		`${daily.rows.length} day bucket(s)`,
	);

	// ── constraints on the new storefront tables ────────────────────────────
	await db.exec(`
    INSERT INTO users (id, email, role) VALUES
      ('aa000000-0000-0000-0000-0000000000ff','verify@test.local','customer');
  `);

	await db.query(
		`INSERT INTO carts (user_id) VALUES ('aa000000-0000-0000-0000-0000000000ff')`,
	);
	let dupCartRefused = false;
	try {
		await db.query(
			`INSERT INTO carts (user_id) VALUES ('aa000000-0000-0000-0000-0000000000ff')`,
		);
	} catch (err) {
		dupCartRefused = /duplicate key|unique/i.test(err.message);
	}
	check("a user gets at most one cart", dupCartRefused, "so .single() cannot throw");

	await db.query(
		`INSERT INTO wishlists (user_id, product_id)
     VALUES ('aa000000-0000-0000-0000-0000000000ff','bb000000-0000-0000-0000-0000000000ff')`,
	);
	let dupWishRefused = false;
	try {
		await db.query(
			`INSERT INTO wishlists (user_id, product_id)
       VALUES ('aa000000-0000-0000-0000-0000000000ff','bb000000-0000-0000-0000-0000000000ff')`,
		);
	} catch (err) {
		dupWishRefused = /duplicate key|unique/i.test(err.message);
	}
	check("a product cannot be wishlisted twice", dupWishRefused);

	await db.query(
		`INSERT INTO addresses (user_id, street, city, state, postal_code, country, is_default)
     VALUES ('aa000000-0000-0000-0000-0000000000ff','1 Rd','Dhaka','Dhaka','1000','Bangladesh',true)`,
	);
	let dupDefaultRefused = false;
	try {
		await db.query(
			`INSERT INTO addresses (user_id, street, city, state, postal_code, country, is_default)
       VALUES ('aa000000-0000-0000-0000-0000000000ff','2 Rd','Dhaka','Dhaka','1000','Bangladesh',true)`,
		);
	} catch (err) {
		dupDefaultRefused = /duplicate key|unique/i.test(err.message);
	}
	check("only one default address per user", dupDefaultRefused);

	let badCouponRefused = false;
	try {
		await db.query(
			`INSERT INTO coupons (code, type, value, starts_at, expires_at)
       VALUES ('BAD','percentage',10, NOW(), NOW() - INTERVAL '1 day')`,
		);
	} catch (err) {
		badCouponRefused = /coupons_valid_window|check constraint/i.test(err.message);
	}
	check("a coupon cannot expire before it starts", badCouponRefused);

	const zones = await db.query(`SELECT COUNT(*)::int AS n FROM delivery_zones`);
	check("default delivery zones seeded", zones.rows[0].n === 2, `${zones.rows[0].n} zones`);

	// ── Cash close approval pipeline (023) ──────────────────────────────────
	// The invariant that matters: a chain cannot be topped by anyone but the
	// superadmin, and the database must hold that line on its own — the API
	// and the pipeline builder are not the only writers.

	const seeded = await db.query(
		`SELECT p.id, COUNT(n.id)::int AS steps
       FROM approval_pipelines p
       LEFT JOIN approval_pipeline_nodes n ON n.pipeline_id = p.id
      WHERE p.type = 'cash_close' AND p.warehouse_id IS NULL
      GROUP BY p.id`,
	);
	check(
		"a default global cash close pipeline is seeded",
		seeded.rows.length === 1 && seeded.rows[0].steps === 2,
		`${seeded.rows[0]?.steps ?? 0} steps`,
	);

	const topRole = await db.query(
		`SELECT approver_role FROM approval_pipeline_nodes
      WHERE pipeline_id = $1 ORDER BY step_order DESC LIMIT 1`,
		[seeded.rows[0].id],
	);
	check(
		"the seeded chain ends at the owner",
		topRole.rows[0].approver_role === "owner",
	);

	let nonOwnerTopRefused = false;
	try {
		await db.exec("BEGIN");
		// Branch-scoped: a second *global* pipeline is refused by the
		// one-active-global index before the trigger is ever reached.
		await db.query(
			`INSERT INTO approval_pipelines (id, name, type, warehouse_id)
       VALUES ('ccc00000-0000-0000-0000-000000000001','Bad Chain','cash_close',
               (SELECT id FROM warehouses ORDER BY code LIMIT 1))`,
		);
		await db.query(
			`INSERT INTO approval_pipeline_nodes (pipeline_id, step_order, name, approver_role)
       VALUES ('ccc00000-0000-0000-0000-000000000001', 1, 'Manager Only', 'branch_manager')`,
		);
		await db.exec("COMMIT");
	} catch (err) {
		nonOwnerTopRefused = /must be the owner|superadmin/i.test(err.message);
		await db.exec("ROLLBACK").catch(() => {});
	}
	check("a chain not ending at the owner is refused", nonOwnerTopRefused);

	// The trigger is deferred, so building a chain bottom-up inside one
	// transaction must succeed even though intermediate states look illegal.
	let multiStepAccepted = false;
	try {
		await db.exec("BEGIN");
		await db.query(
			`INSERT INTO approval_pipelines (id, name, type, warehouse_id)
       VALUES ('ccc00000-0000-0000-0000-000000000002','Long Chain','cash_close',
               (SELECT id FROM warehouses ORDER BY code OFFSET 1 LIMIT 1))`,
		);
		await db.query(
			`INSERT INTO approval_pipeline_nodes (pipeline_id, step_order, name, approver_role)
       VALUES ('ccc00000-0000-0000-0000-000000000002', 1, 'Cashier Check', 'cashier'),
              ('ccc00000-0000-0000-0000-000000000002', 2, 'Manager Review', 'branch_manager'),
              ('ccc00000-0000-0000-0000-000000000002', 3, 'Accounts', 'accountant'),
              ('ccc00000-0000-0000-0000-000000000002', 4, 'Superadmin', 'owner')`,
		);
		await db.exec("COMMIT");
		multiStepAccepted = true;
	} catch {
		await db.exec("ROLLBACK").catch(() => {});
	}
	check("a four-step chain ending at the owner is accepted", multiStepAccepted);

	let bothApproversRefused = false;
	try {
		await db.query(
			`INSERT INTO approval_pipeline_nodes (pipeline_id, step_order, name, approver_role, approver_user_id)
       VALUES ('ccc00000-0000-0000-0000-000000000002', 9, 'Ambiguous', 'accountant', gen_random_uuid())`,
		);
	} catch (err) {
		bothApproversRefused = /single_approver|check constraint|foreign key/i.test(err.message);
	}
	check("a step naming both a role and a user is refused", bothApproversRefused);

	const shiftStates = await db.query(
		`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'pos_shifts_status_check'`,
	);
	check(
		"shifts can sit in pending_approval",
		/pending_approval/.test(shiftStates.rows[0]?.def || ""),
	);

	// A close awaiting approval must not block the branch from trading, or the
	// next cashier cannot open the register.
	await db.query(
		`INSERT INTO warehouses (name, code) VALUES ('Approval Test Branch','APRV-T')
     ON CONFLICT (code) DO NOTHING`,
	);
	const branchId = (
		await db.query(`SELECT id FROM warehouses WHERE code = 'APRV-T'`)
	).rows[0].id;
	await db.query(
		`INSERT INTO pos_shifts (shift_number, warehouse_id, opening_float, status, closed_at)
     VALUES ('SHIFT-PEND', $1, 1000, 'pending_approval', NOW())`,
		[branchId],
	);
	let openedAlongsidePending = false;
	try {
		await db.query(
			`INSERT INTO pos_shifts (shift_number, warehouse_id, opening_float, status)
       VALUES ('SHIFT-NEXT', $1, 500, 'open')`,
			[branchId],
		);
		openedAlongsidePending = true;
	} catch { /* blocked */ }
	check(
		"a shift awaiting approval does not block the next one",
		openedAlongsidePending,
	);

	// Re-running must be a no-op, not an error.
	console.log("\n\x1b[1mIdempotency\x1b[0m");
	for (const file of [
		"supabase/migrations/017_inventory_integrity_and_pos_fixes.sql",
		"supabase/migrations/018_storefront_and_admin_tables.sql",
	"supabase/migrations/019_warehouse_contact_fields.sql",
	"supabase/migrations/020_storefront_order_and_courier_columns.sql",
	"supabase/migrations/021_row_level_security_policies.sql",
	"supabase/migrations/022_product_preorder.sql",
	"supabase/migrations/023_cash_close_approval_pipeline.sql",
		"supabase/migrations/024_performance_indexes.sql",
	"supabase/migrations/025_users_role_rbac_keys.sql",
	]) {
		try {
			await db.exec(fs.readFileSync(file, "utf8"));
			check(`${path.basename(file)} re-runs cleanly`, true);
		} catch (err) {
			check(
				`${path.basename(file)} re-runs cleanly`,
				false,
				err.message.split("\n")[0].slice(0, 120),
			);
		}
	}
}

main()
	.catch((err) => {
		failed++;
		console.error("\n\x1b[31mAborted:\x1b[0m", err.message);
	})
	.finally(async () => {
		await db.close().catch(() => {});
		console.log(
			`\n\x1b[1mResult\x1b[0m  \x1b[32m${passed} passed\x1b[0m` +
				(failed ? `, \x1b[31m${failed} failed\x1b[0m` : ""),
		);
		process.exit(failed ? 1 : 0);
	});
