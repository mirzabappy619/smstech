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
 * Algorithm:
 * 1. Fetch order items
 * 2. Find the best warehouse that has stock for ALL items,
 *    scored by distance to the customer's shipping address
 * 3. Reserve inventory (30-minute expiry)
 * 4. Create order_fulfillments record
 * 5. Return fulfillment details (ready for delivery partner integration)
 */
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
			.single();

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

		// ── 2. Extract customer lat/lng from shipping address ────────────────
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const shippingAddr: any = order.shipping_address || {};
		const customerLat = parseFloat(shippingAddr.latitude) || 0;
		const customerLng = parseFloat(shippingAddr.longitude) || 0;

		// ── 3. Fetch all active warehouses ───────────────────────────────────
		const { data: warehouses } = await supabase
			.from("locations")
			.select("id, name, address_street, address_city, address_state, latitude, longitude, phone")
			.eq("is_active", true);

		if (!warehouses || warehouses.length === 0) {
			return errorResponse(
				"NO_WAREHOUSES",
				"No active warehouses configured",
				HTTP_STATUS.CONFLICT,
			);
		}

		// ── 4. Find best warehouse ───────────────────────────────────────────
		let selectedWarehouse: (typeof warehouses)[0] | null = null;
		let bestScore = -Infinity;

		for (const warehouse of warehouses) {
			// Check if warehouse can fulfil all items
			let hasAllStock = true;

			for (const item of items) {
				if (!item.variation_id) continue; // product-level item, skip

				const { data: inv } = await supabase
					.from("inventory")
					.select("available_quantity")
					.eq("variation_id", item.variation_id)
					.eq("location_id", warehouse.id)
					.single();

				if (!inv || inv.available_quantity < item.quantity) {
					hasAllStock = false;
					break;
				}
			}

			if (!hasAllStock) continue;

			// Score by proximity (Euclidean approximation — good enough for scoring)
			const wLat = parseFloat(String(warehouse.latitude)) || 0;
			const wLng = parseFloat(String(warehouse.longitude)) || 0;
			const distance = Math.sqrt(
				Math.pow(wLat - customerLat, 2) + Math.pow(wLng - customerLng, 2),
			);
			// Avoid division by zero; closer = higher score
			const score = 1 / (distance + 0.001);

			if (score > bestScore) {
				bestScore = score;
				selectedWarehouse = warehouse;
			}
		}

		if (!selectedWarehouse) {
			return errorResponse(
				"NO_STOCK",
				"No warehouse has sufficient stock for all order items",
				HTTP_STATUS.CONFLICT,
			);
		}

		// ── 5. Reserve inventory (30-minute window) ──────────────────────────
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

		for (const item of items) {
			if (!item.variation_id) continue;

			// Increment reserved_quantity
			await supabase.rpc("increment_reserved_quantity", {
				p_variation_id: item.variation_id,
				p_location_id: selectedWarehouse.id,
				p_quantity: item.quantity,
				p_order_id: orderId,
				p_expires_at: expiresAt,
			}).then(({ error }) => {
				if (error) {
					// Fallback: manual update if RPC not available
					supabase
						.from("inventory")
						.select("id, reserved_quantity")
						.eq("variation_id", item.variation_id)
						.eq("location_id", selectedWarehouse!.id)
						.single()
						.then(({ data: inv }) => {
							if (inv) {
								supabase
									.from("inventory")
									.update({
										reserved_quantity: inv.reserved_quantity + item.quantity,
										reserved_for_order_id: orderId,
										reservation_expires_at: expiresAt,
									})
									.eq("id", inv.id);
							}
						});
				}
			});
		}

		// ── 6. Create fulfillment record ─────────────────────────────────────
		const { data: fulfillment, error: fulfillError } = await supabase
			.from("order_fulfillments")
			.upsert(
				{
					order_id: orderId,
					location_id: selectedWarehouse.id,
					status: "pending",
					metadata: {
						warehouse_name: selectedWarehouse.name,
						warehouse_city: selectedWarehouse.address_city,
						reserved_at: new Date().toISOString(),
						reservation_expires_at: expiresAt,
					},
				},
				{ onConflict: "order_id" },
			)
			.select("*")
			.single();

		if (fulfillError || !fulfillment) {
			return errorResponse(
				"FULFILLMENT_CREATE_FAILED",
				"Failed to create fulfillment record",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// ── 7. Return result (caller can now send to delivery partner) ────────
		return successResponse(
			{
				message: "Order fulfillment initiated successfully",
				fulfillment_id: fulfillment.id,
				warehouse: {
					id: selectedWarehouse.id,
					name: selectedWarehouse.name,
					address_street: selectedWarehouse.address_street,
					address_city: selectedWarehouse.address_city,
					address_state: selectedWarehouse.address_state,
					latitude: selectedWarehouse.latitude,
					longitude: selectedWarehouse.longitude,
					phone: selectedWarehouse.phone,
				},
				reservation_expires_at: expiresAt,
				items_count: items.length,
				// Attach items for delivery partner payload construction
				items: items.map((i) => ({
					product_id: i.product_id,
					variation_id: i.variation_id,
					sku: i.sku,
					name: i.name,
					quantity: i.quantity,
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

/**
 * GET /api/v1/orders/[id]/fulfill
 * Get the current fulfillment status for an order.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const orderId = (await params).id;
		const supabase = await createAdminClient();

		const { data: fulfillment, error } = await supabase
			.from("order_fulfillments")
			.select("*, locations(id, name, address_city, phone)")
			.eq("order_id", orderId)
			.single();

		if (error || !fulfillment) {
			return errorResponse(
				"FULFILLMENT_NOT_FOUND",
				"No fulfillment found for this order",
				HTTP_STATUS.NOT_FOUND,
			);
		}

		return successResponse(fulfillment);
	} catch (error) {
		console.error("Get fulfillment error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
