import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { errorResponse, jsonResponse, requireAdmin } from "@/lib/api-utils";
// MetaPixelService removed — Purchase tracking fires at order creation only.
// Re-firing on status "confirmed" caused double-counting in Facebook Event Manager.

// GET /api/v1/admin/orders/[id] - Get order details (admin only)
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Require admin authentication
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();
		const { id: orderId } = await params;

		console.log("=== ADMIN ORDER DETAIL API ===");
		console.log("Fetching order with ID:", orderId);
		console.log("Order ID type:", typeof orderId);
		console.log("Order ID length:", orderId?.length);

		// Get order first (without user join to avoid issues with guest orders)
		const { data: order, error: orderError } = await supabase
			.from("orders")
			.select("*")
			.eq("id", orderId)
			.single();

		console.log("Order query completed");
		console.log("Order data:", JSON.stringify(order, null, 2));
		console.log("Order error:", JSON.stringify(orderError, null, 2));

		if (orderError) {
			console.error(
				"Database error fetching order:",
				orderError.message,
				orderError.code,
				orderError.details,
			);
			return errorResponse(
				"NOT_FOUND",
				`Order not found: ${orderError.message}`,
				404,
			);
		}

		if (!order) {
			console.error("No order data returned (order is null/undefined)");
			return errorResponse(
				"NOT_FOUND",
				"Order not found - no data returned",
				404,
			);
		}

		// Get user info separately if user_id exists
		let userData = null;
		if (order.user_id) {
			const { data: user } = await supabase
				.from("users")
				.select("id, email, first_name, last_name, phone")
				.eq("id", order.user_id)
				.single();
			userData = user;
		}

		// Get order items — name/sku/attributes are stored at order time; join products only for images
		const { data: items, error: itemsError } = await supabase
			.from("order_items")
			.select("id, quantity, unit_price, total_price, product_id, variation_id, name, sku, attributes")
			.eq("order_id", orderId);

		if (itemsError) {
			console.error("Error fetching order items:", itemsError);
			return errorResponse("DATABASE_ERROR", itemsError.message, 500);
		}

		// Fetch product images separately (product may have been updated since order was placed)
		const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))];
		let productImageMap: Record<string, string[]> = {};

		if (productIds.length > 0) {
			const { data: products } = await supabase
				.from("products")
				.select("id, images")
				.in("id", productIds);
			if (products) {
				productImageMap = Object.fromEntries(
					products.map((p: any) => [p.id, p.images || []]),
				);
			}
		}

		// Format the response (userData is already fetched separately above)
		const formattedOrder = {
			id: order.id,
			order_number: order.order_number,
			status: order.status,
			payment_status: order.payment_status || "pending",
			total_amount: order.total,
			subtotal: order.subtotal,
			tax_amount: order.tax_amount,
			shipping_amount: order.shipping_amount,
			discount_amount: order.discount_amount,
			payment_method: order.payment_method || "unknown",
			shipping_method: order.shipping_method || "standard",
			tracking_number: order.tracking_number,
			source: order.source,
			created_at: order.created_at,
			updated_at: order.updated_at,
			customer: userData
				? {
						id: userData.id,
						first_name: userData.first_name || "",
						last_name: userData.last_name || "",
						email: userData.email || "",
						phone: userData.phone || null,
					}
				: null,
			shipping_address:
				typeof order.shipping_address === "string"
					? JSON.parse(order.shipping_address)
					: order.shipping_address,
			billing_address:
				typeof order.billing_address === "string"
					? JSON.parse(order.billing_address)
					: order.billing_address,
			items: (items || []).map((item: any) => ({
				id: item.id,
				product_name: item.name || "Unknown Product",
				variation_name: item.attributes?.variation_name || null,
				quantity: item.quantity,
				unit_price: item.unit_price,
				total_price: item.total_price,
				image_url: productImageMap[item.product_id]?.[0] || null,
			})),
			notes: order.notes,
		};

		return jsonResponse(formattedOrder);
	} catch (error) {
		console.error("Admin order detail GET error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// PUT /api/v1/admin/orders/[id] - Update order status (admin only)
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Require admin authentication
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();
		const { id: orderId } = await params;
		const body = await request.json();

		const updateData: any = {};
		if (body.status) updateData.status = body.status;
		if (body.payment_status) updateData.payment_status = body.payment_status;
		if (body.tracking_number !== undefined)
			updateData.tracking_number = body.tracking_number;
		if (body.notes !== undefined) updateData.notes = body.notes;

		const { data: order, error: updateError } = await supabase
			.from("orders")
			.update(updateData)
			.eq("id", orderId)
			.select()
			.single();

		if (updateError || !order) {
			console.error("Error updating order:", updateError);
			return errorResponse(
				"UPDATE_FAILED",
				updateError?.message || "Failed to update order",
				500,
			);
		}

		return jsonResponse({
			message: "Order updated successfully",
			order,
		});
	} catch (error) {
		console.error("Admin order update PUT error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
