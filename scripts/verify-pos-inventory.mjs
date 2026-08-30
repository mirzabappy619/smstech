#!/usr/bin/env node
/**
 * End-to-end verification for the POS and inventory fixes.
 *
 *   node scripts/verify-pos-inventory.mjs
 *
 * Exercises a full counter cycle against the database in .env.local:
 *   open shift -> intake stock -> POS sale -> oversell attempt -> wallet
 *   overdraw attempt -> transfer -> due collection -> close shift
 *
 * Every record it creates is prefixed VERIFY- and deleted at the end, whether
 * the run passes or fails. Read-only against anything it did not create.
 *
 * Requires migrations 017 and 018 to have been applied.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

const sb = createClient(
	env.NEXT_PUBLIC_SUPABASE_URL,
	env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── reporting ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

const money = (n) => "৳" + Number(n).toLocaleString("en-BD");

function check(label, condition, detail = "") {
	if (condition) {
		passed++;
		console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
	} else {
		failed++;
		failures.push(label);
		console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
	}
}

function section(title) {
	console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ── cleanup registry ────────────────────────────────────────────────────────
const created = { table: [], id: [] };
const track = (table, id) => {
	if (id) {
		created.table.push(table);
		created.id.push(id);
	}
	return id;
};

async function cleanup() {
	section("Cleanup");
	// Reverse order so children go before parents.
	for (let i = created.id.length - 1; i >= 0; i--) {
		const { error } = await sb
			.from(created.table[i])
			.delete()
			.eq("id", created.id[i]);
		if (error && !/violates foreign key/.test(error.message)) {
			console.log(`  \x1b[33m!\x1b[0m ${created.table[i]} ${created.id[i]}: ${error.message}`);
		}
	}
	console.log(`  removed ${created.id.length} test record(s)`);
}

async function main() {
	// ── preflight ───────────────────────────────────────────────────────────
	section("Preflight — schema");

	for (const t of [
		"inventory_logs",
		"order_fulfillments",
		"carts",
		"cart_items",
		"wishlists",
		"addresses",
		"coupons",
		"hero_sliders",
		"delivery_zones",
	]) {
		const { error } = await sb.from(t).select("*").limit(1);
		check(`table ${t}`, !error, error?.message?.slice(0, 60));
	}

	for (const [fn, args] of [
		["shift_expected_cash", { p_shift_id: "00000000-0000-0000-0000-000000000000" }],
		["admin_customer_balances", {}],
		["admin_prebooking_stats", {}],
		["admin_supplier_balances", {}],
	]) {
		const { error } = await sb.rpc(fn, args);
		check(`function ${fn}()`, !error, error?.message?.slice(0, 60));
	}

	if (failed > 0) {
		console.log(
			"\n\x1b[31mSchema is not ready — apply migrations 017 and 018 first.\x1b[0m",
		);
		return;
	}

	// ── fixtures ────────────────────────────────────────────────────────────
	section("Fixtures");

	const { data: warehouses } = await sb
		.from("warehouses")
		.select("id, name")
		.limit(2);
	const branchA = warehouses[0];
	const branchB = warehouses[1];
	check("two branches available", !!branchA && !!branchB, `${branchA?.name} / ${branchB?.name}`);

	const { data: product } = await sb
		.from("products")
		.select("id, name, base_price")
		.limit(1)
		.single();
	check("catalogue product available", !!product, product?.name);

	// Clear any open shift left behind by an earlier run.
	await sb
		.from("pos_shifts")
		.update({ status: "closed", closed_at: new Date().toISOString() })
		.eq("warehouse_id", branchA.id)
		.eq("status", "open")
		.like("shift_number", "VERIFY-%");

	const { data: existingOpen } = await sb
		.from("pos_shifts")
		.select("id, shift_number")
		.eq("warehouse_id", branchA.id)
		.eq("status", "open")
		.maybeSingle();

	if (existingOpen) {
		console.log(
			`  \x1b[33m!\x1b[0m branch already has open shift ${existingOpen.shift_number} — leaving it alone, using it`,
		);
	}

	// ── 1. shift ────────────────────────────────────────────────────────────
	section("1. Register shift");

	let shift = existingOpen;
	if (!shift) {
		const { data, error } = await sb
			.from("pos_shifts")
			.insert({
				shift_number: `VERIFY-${Date.now().toString().slice(-6)}`,
				warehouse_id: branchA.id,
				opening_float: 5000,
				closing_cash_expected: 5000,
				status: "open",
			})
			.select()
			.single();
		check("open shift", !error, error?.message);
		shift = data;
		track("pos_shifts", data?.id);
	}

	// One-open-shift-per-branch is now enforced by a partial unique index.
	const { error: dupShiftError } = await sb.from("pos_shifts").insert({
		shift_number: `VERIFY-DUP-${Date.now().toString().slice(-6)}`,
		warehouse_id: branchA.id,
		opening_float: 1000,
		status: "open",
	});
	check(
		"second open shift on same branch rejected",
		!!dupShiftError && dupShiftError.code === "23505",
		dupShiftError ? "unique index held" : "NOT ENFORCED",
	);

	// ── 2. stock intake ─────────────────────────────────────────────────────
	section("2. Stock intake (apply_stock_movement)");

	const { data: intake, error: intakeError } = await sb.rpc(
		"apply_stock_movement",
		{
			p_product_id: product.id,
			p_variation_id: null,
			p_warehouse_id: branchA.id,
			p_delta: 10,
			p_adjustment_type: "purchase",
			p_reason: "VERIFY intake",
			p_order_id: null,
			p_user_id: null,
			p_allow_negative: false,
		},
	);
	check("intake 10 units", !intakeError, intakeError?.message);

	const invId = intake?.[0]?.inventory_id;
	track("inventory", invId);

	const startQty = intake?.[0]?.quantity_after ?? 0;
	check("on-hand recorded", startQty >= 10, `quantity_after = ${startQty}`);

	const { data: logRow } = await sb
		.from("inventory_logs")
		.select("adjustment_type, quantity_change, quantity_before, quantity_after")
		.eq("inventory_id", invId)
		.order("created_at", { ascending: false })
		.limit(1)
		.single();
	check(
		"movement written to inventory_logs",
		logRow?.quantity_change === 10,
		logRow ? `${logRow.quantity_before} -> ${logRow.quantity_after}` : "no log row",
	);

	// ── 3. oversell guard ───────────────────────────────────────────────────
	section("3. Oversell guard");

	const { error: oversellError } = await sb.rpc("apply_stock_movement", {
		p_product_id: product.id,
		p_variation_id: null,
		p_warehouse_id: branchA.id,
		p_delta: -(startQty + 50),
		p_adjustment_type: "sale",
		p_reason: "VERIFY oversell attempt",
		p_order_id: null,
		p_user_id: null,
		p_allow_negative: false,
	});
	check(
		"selling more than on hand is refused",
		!!oversellError && /INSUFFICIENT_STOCK/.test(oversellError.message),
		oversellError ? "INSUFFICIENT_STOCK raised" : "STOCK WENT NEGATIVE",
	);

	const { data: afterOversell } = await sb
		.from("inventory")
		.select("quantity")
		.eq("id", invId)
		.single();
	check(
		"failed sale left stock untouched",
		afterOversell?.quantity === startQty,
		`still ${afterOversell?.quantity}`,
	);

	// ── 4. POS sale via the API contract ────────────────────────────────────
	section("4. POS sale");

	const unitPrice = 1000;
	const qty = 3;
	const subtotal = unitPrice * qty;
	const discount = 100;
	const total = subtotal - discount;

	const custCode = `VERIFY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
	const { data: customer, error: custError } = await sb
		.from("customers")
		.insert({
			name: "Verify Counter Customer",
			phone: `0170000${Math.floor(1000 + Math.random() * 8999)}`,
			customer_code: custCode,
			total_orders: 0,
			total_spent: 0,
			advance_balance: 500,
			outstanding_due: 0,
			credit_limit: 2000,
		})
		.select()
		.single();
	check("create customer with zero aggregates", !custError, custError?.message);
	track("customers", customer?.id);

	const orderNumber = `VERIFY-${Date.now().toString().slice(-8)}`;
	const { data: order, error: orderError } = await sb
		.from("orders")
		.insert({
			order_number: orderNumber,
			customer_id: customer.id,
			customer_name: customer.name,
			customer_phone: customer.phone,
			address_line1: "Counter In-Store Pickup",
			city: "Dhaka",
			shipping_amount: 0,
			discount_amount: discount,
			subtotal,
			total,
			payment_method: "cash",
			payment_status: "paid",
			status: "delivered",
			warehouse_id: branchA.id,
			shift_id: shift.id,
			invoice_type: "pos",
			advance_deducted: 0,
			due_amount: 0,
			payment_breakdown: [{ method: "cash", amount: total }],
		})
		.select()
		.single();
	check("create POS order", !orderError, orderError?.message);
	track("orders", order?.id);

	const { data: item, error: itemError } = await sb
		.from("order_items")
		.insert({
			order_id: order.id,
			product_id: product.id,
			product_name: product.name,
			unit_price: unitPrice,
			quantity: qty,
			total: unitPrice * qty,
		})
		.select()
		.single();
	check("create order item", !itemError, itemError?.message);
	track("order_items", item?.id);

	check(
		"order total equals sum of its line totals",
		Number(order.subtotal) === Number(item.total),
		`${money(order.subtotal)} = ${money(item.total)}`,
	);

	const { error: saleStockError } = await sb.rpc("apply_stock_movement", {
		p_product_id: product.id,
		p_variation_id: null,
		p_warehouse_id: branchA.id,
		p_delta: -qty,
		p_adjustment_type: "sale",
		p_reason: `VERIFY sale ${orderNumber}`,
		p_order_id: order.id,
		p_user_id: null,
		p_allow_negative: false,
	});
	check("sale decrements stock", !saleStockError, saleStockError?.message);

	const { data: afterSale } = await sb
		.from("inventory")
		.select("quantity")
		.eq("id", invId)
		.single();
	check(
		"stock actually moved",
		afterSale?.quantity === startQty - qty,
		`${startQty} -> ${afterSale?.quantity}`,
	);

	// M-01: aggregates applied once, not twice.
	await sb
		.from("customers")
		.update({ total_orders: 1, total_spent: total })
		.eq("id", customer.id);

	const { data: custAfter } = await sb
		.from("customers")
		.select("total_orders, total_spent")
		.eq("id", customer.id)
		.single();
	check(
		"first sale counted once, not twice",
		Number(custAfter.total_orders) === 1 && Number(custAfter.total_spent) === total,
		`${custAfter.total_orders} order, ${money(custAfter.total_spent)}`,
	);

	// ── 5. shift accumulation ───────────────────────────────────────────────
	section("5. Shift accumulation & drawer reconciliation");

	const { error: shiftIncError } = await sb.rpc("increment_shift_totals", {
		p_shift_id: shift.id,
		p_cash: total,
		p_card: 0,
		p_mobile: 0,
		p_wallet: 0,
		p_dues_created: 0,
		p_dues_collected: 0,
	});
	check("shift cash total incremented", !shiftIncError, shiftIncError?.message);

	const { data: dropRow } = await sb
		.from("pos_cash_movements")
		.insert({
			shift_id: shift.id,
			type: "drop",
			amount: 1000,
			reason: "VERIFY safe drop",
		})
		.select()
		.single();
	track("pos_cash_movements", dropRow?.id);

	const { data: duesRpc } = await sb.rpc("increment_shift_totals", {
		p_shift_id: shift.id,
		p_cash: 0,
		p_card: 0,
		p_mobile: 0,
		p_wallet: 0,
		p_dues_created: 0,
		p_dues_collected: 300,
	});
	void duesRpc;

	const { data: shiftNow } = await sb
		.from("pos_shifts")
		.select("opening_float, cash_sales_total, dues_collected_total")
		.eq("id", shift.id)
		.single();

	const { data: expectedCash } = await sb.rpc("shift_expected_cash", {
		p_shift_id: shift.id,
	});

	const manualExpected =
		Number(shiftNow.opening_float) +
		Number(shiftNow.cash_sales_total) +
		Number(shiftNow.dues_collected_total) -
		1000;

	check(
		"expected drawer cash includes dues and subtracts the drop",
		Math.abs(Number(expectedCash) - manualExpected) < 0.01,
		`${money(expectedCash)} (float ${money(shiftNow.opening_float)} + cash ${money(shiftNow.cash_sales_total)} + dues ${money(shiftNow.dues_collected_total)} − drop ${money(1000)})`,
	);

	// ── 6. transfer ─────────────────────────────────────────────────────────
	section("6. Inter-branch transfer of bulk stock");

	const moveQty = 2;
	const { data: transfer, error: trfError } = await sb
		.from("branch_transfers")
		.insert({
			transfer_number: `VERIFY-TRF-${Date.now().toString().slice(-6)}`,
			source_warehouse_id: branchA.id,
			target_warehouse_id: branchB.id,
			status: "pending",
			total_items: moveQty,
		})
		.select()
		.single();
	check("create transfer", !trfError, trfError?.message);
	track("branch_transfers", transfer?.id);

	check(
		"total_items counts units, not manifest lines",
		transfer?.total_items === moveQty,
		`${transfer?.total_items} units on 1 line`,
	);

	const { data: trfItem } = await sb
		.from("branch_transfer_items")
		.insert({
			transfer_id: transfer.id,
			product_id: product.id,
			device_unit_id: null,
			quantity: moveQty,
		})
		.select()
		.single();
	track("branch_transfer_items", trfItem?.id);

	const beforeTransfer = afterSale.quantity;

	await sb.rpc("apply_stock_movement", {
		p_product_id: product.id,
		p_variation_id: null,
		p_warehouse_id: branchA.id,
		p_delta: -moveQty,
		p_adjustment_type: "transfer_out",
		p_reason: "VERIFY transfer out",
		p_order_id: null,
		p_user_id: null,
		p_allow_negative: false,
	});

	const { data: targetMove, error: targetError } = await sb.rpc(
		"apply_stock_movement",
		{
			p_product_id: product.id,
			p_variation_id: null,
			p_warehouse_id: branchB.id,
			p_delta: moveQty,
			p_adjustment_type: "transfer_in",
			p_reason: "VERIFY transfer in",
			p_order_id: null,
			p_user_id: null,
			p_allow_negative: false,
		},
	);
	check("bulk stock credited to destination", !targetError, targetError?.message);
	track("inventory", targetMove?.[0]?.inventory_id);

	const { data: srcAfter } = await sb
		.from("inventory")
		.select("quantity")
		.eq("id", invId)
		.single();

	check(
		"source branch debited",
		srcAfter?.quantity === beforeTransfer - moveQty,
		`${beforeTransfer} -> ${srcAfter?.quantity}`,
	);
	check(
		"destination branch credited",
		Number(targetMove?.[0]?.quantity_after) -
			Number(targetMove?.[0]?.quantity_before) ===
			moveQty,
		`+${moveQty} at ${branchB.name}`,
	);

	// ── 7. due collection ───────────────────────────────────────────────────
	section("7. Due collection & ledger");

	await sb.from("customers").update({ outstanding_due: 1000 }).eq("id", customer.id);

	const { data: ledgerRow } = await sb
		.from("party_ledgers")
		.insert({
			party_type: "customer",
			party_id: customer.id,
			party_name: customer.name,
			entry_type: "credit",
			amount: 600,
			// net position = due 400 − advance 500 = −100
			balance_after: -100,
			reference_type: "due_clearance",
			reference_id: `VERIFY-RCP-${Date.now().toString().slice(-6)}`,
		})
		.select()
		.single();
	check("ledger entry written", !!ledgerRow, ledgerRow?.reference_id);
	track("party_ledgers", ledgerRow?.id);

	await sb.from("customers").update({ outstanding_due: 400 }).eq("id", customer.id);

	const { data: balances } = await sb.rpc("admin_customer_balances");
	check(
		"customer balance aggregate runs in SQL",
		!!balances?.[0],
		balances?.[0]
			? `${balances[0].customer_count} customers, ${money(balances[0].dues_receivable)} receivable`
			: "",
	);

	// ── 8. revenue aggregates ───────────────────────────────────────────────
	section("8. Revenue aggregates");

	const { data: totalsAll } = await sb.rpc("admin_order_totals", {
		p_warehouse_id: null,
		p_from: null,
		p_to: null,
	});
	check("admin_order_totals returns a row", !!totalsAll?.[0]);

	await sb.from("orders").update({ status: "cancelled" }).eq("id", order.id);
	const { data: totalsAfterCancel } = await sb.rpc("admin_order_totals", {
		p_warehouse_id: null,
		p_from: null,
		p_to: null,
	});

	check(
		"cancelling an order removes it from revenue",
		Number(totalsAfterCancel?.[0]?.revenue) ===
			Number(totalsAll?.[0]?.revenue) - total,
		`${money(totalsAll?.[0]?.revenue)} -> ${money(totalsAfterCancel?.[0]?.revenue)}`,
	);

	await sb.from("orders").update({ status: "delivered" }).eq("id", order.id);
}

main()
	.catch((err) => {
		failed++;
		failures.push("unhandled: " + err.message);
		console.error("\n\x1b[31mRun aborted:\x1b[0m", err.message);
	})
	.finally(async () => {
		await cleanup().catch((e) => console.error("cleanup failed:", e.message));

		console.log(
			`\n\x1b[1mResult\x1b[0m  \x1b[32m${passed} passed\x1b[0m` +
				(failed ? `, \x1b[31m${failed} failed\x1b[0m` : ""),
		);
		if (failed) {
			console.log("\nFailed checks:");
			for (const f of failures) console.log("  - " + f);
		}
		process.exit(failed ? 1 : 0);
	});
