import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	requireAdmin,
	successResponse,
} from "@/lib/api-utils";

/**
 * POST /api/v1/orders/[id]/fulfill
 *
 * 1. Fetch order items
 * 2. Pick a warehouse that can cover every item, preferring the order's own
 *    branch, then the default branch
 * 3. Reserve that stock atomically (30-minute expiry)
 * 4. Create the order_fulfillments record
 */
const RESERVATION_MINUTES = 30;

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const orderId = (await params).id;
		const supabase = await createAdminClient();

		// ── 1. Fetch order with items ────────────────────────────────────────
		const { data: order, error: orderError } = await supabase
			.from("orders")
			.select("*, order_items(*)")
			.eq("id", orderId)
			.single();

		if (orderError || !order) {
			return errorResponse(
				"ORDER_NOT_FOUND",
				"Order not found",
				HTTP_STATUS.NOT_FOUND,
			);
		}

		// Prevent double-fulfillment
		const { data: existingFulfillment } = await supabase
			.from("order_fulfillments")
			.select("id, status")
			.eq("order_id", orderId)
			.maybeSingle();

		if (existingFulfillment && existingFulfillment.status !== "failed") {
			return errorResponse(
				"ALREADY_FULFILLED",
				"Order already has an active fulfillment",
				HTTP_STATUS.CONFLICT,
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const items: any[] = order.order_items || [];
		if (items.length === 0) {
			return errorResponse(
				"NO_ITEMS",
				"Order has no items",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		// Serialized units are already pinned to a specific device, so they do
		// not draw down pooled inventory.
		const pooledItems = items.filter((i) => !i.device_unit_id && i.product_id);

		// ── 2. Fetch candidate branches ──────────────────────────────────────
		const { data: warehouses } = await supabase
			.from("warehouses")
			.select("id, name, code, address, is_default")
			.eq("is_active", true);

		if (!warehouses || warehouses.length === 0) {
			return errorResponse(
				"NO_WAREHOUSES",
				"No active warehouses configured",
				HTTP_STATUS.CONFLICT,
			);
		}

		// Prefer the branch the order was taken at, then the default branch.
		const ranked = [...warehouses].sort((a, b) => {
			const score = (w: typeof a) =>
				(w.id === order.warehouse_id ? 2 : 0) + (w.is_default ? 1 : 0);
			return score(b) - score(a);
		});

		// ── 3. Pick the first branch that can cover every pooled item ────────
		let selectedWarehouse: (typeof ranked)[0] | null = null;

		for (const warehouse of ranked) {
			if (pooledItems.length === 0) {
				selectedWarehouse = warehouse;
				break;
			}

			const { data: stock } = await supabase
				.from("inventory")
				.select("product_id, variation_id, available_quantity")
				.eq("warehouse_id", warehouse.id)
				.in(
					"product_id",
					pooledItems.map((i) => i.product_id),
				);

			const covers = pooledItems.every((item) => {
				const row = (stock || []).find(
					(s) =>
						s.product_id === item.product_id &&
						(s.variation_id ?? null) === (item.variation_id ?? null),
				);
				return (row?.available_quantity ?? 0) >= item.quantity;
			});

			if (covers) {
				selectedWarehouse = warehouse;
				break;
			}
		}

		if (!selectedWarehouse) {
			return errorResponse(
				"NO_STOCK",
				"No branch has enough stock to cover every item on this order",
				HTTP_STATUS.CONFLICT,
			);
		}

		// ── 4. Reserve the stock ─────────────────────────────────────────────
		const expiresAt = new Date(
			Date.now() + RESERVATION_MINUTES * 60 * 1000,
		).toISOString();

		const reserved: { product_id: string; variation_id: string | null; quantity: number }[] = [];

		for (const item of pooledItems) {
			const { error: reserveError } = await supabase.rpc(
				"reserve_stock",
				{
					p_product_id: item.product_id,
					p_variation_id: item.variation_id ?? null,
					p_warehouse_id: selectedWarehouse.id,
					p_quantity: item.quantity,
				},
			);

			if (reserveError) {
				// Release anything already held so a partial failure does not
				// strand stock in a reserved state.
				for (const done of reserved) {
					await supabase.rpc("reserve_stock", {
						p_product_id: done.product_id,
						p_variation_id: done.variation_id,
						p_warehouse_id: selectedWarehouse.id,
						p_quantity: -done.quantity,
					});
				}

				return errorResponse(
					"RESERVATION_FAILED",
					reserveError.message?.includes("INSUFFICIENT_STOCK")
						? "Stock ran out while reserving this order. Try again."
						: "Failed to reserve inventory",
					HTTP_STATUS.CONFLICT,
				);
			}

			reserved.push({
				product_id: item.product_id,
				variation_id: item.variation_id ?? null,
				quantity: item.quantity,
			});
		}

		// ── 5. Create fulfillment record ─────────────────────────────────────
		const { data: fulfillment, error: fulfillError } = await supabase
			.from("order_fulfillments")
			.upsert(
				{
					order_id: orderId,
					warehouse_id: selectedWarehouse.id,
					status: "pending",
					reservation_expires_at: expiresAt,
					metadata: {
						warehouse_name: selectedWarehouse.name,
						warehouse_code: selectedWarehouse.code,
						reserved_at: new Date().toISOString(),
						reserved_items: reserved,
					},
				},
				{ onConflict: "order_id" },
			)
			.select("*")
			.single();

		if (fulfillError || !fulfillment) {
			// Roll the reservations back rather than leaving stock held against
			// a fulfillment that does not exist.
			for (const done of reserved) {
				await supabase.rpc("reserve_stock", {
					p_product_id: done.product_id,
					p_variation_id: done.variation_id,
					p_warehouse_id: selectedWarehouse.id,
					p_quantity: -done.quantity,
				});
			}

			console.error("Fulfillment create failed:", fulfillError);
			return errorResponse(
				"FULFILLMENT_CREATE_FAILED",
				"Failed to create fulfillment record",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return successResponse(
			{
				message: "Order fulfillment initiated successfully",
				fulfillment_id: fulfillment.id,
				warehouse: {
					id: selectedWarehouse.id,
					name: selectedWarehouse.name,
					code: selectedWarehouse.code,
					address: selectedWarehouse.address,
				},
				reservation_expires_at: expiresAt,
				items_count: items.length,
				items: items.map((i) => ({
					product_id: i.product_id,
					variation_id: i.variation_id,
					name: i.product_name,
					quantity: i.quantity,
					serial_number: i.serial_number ?? null,
				})),
			},
			HTTP_STATUS.CREATED,
		);
	} catch (error) {
		console.error("Order fulfillment error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Failed to process fulfillment",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
