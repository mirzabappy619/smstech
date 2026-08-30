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

		// Orders carry a customer_id (not a user_id) plus a snapshot of the
		// customer's details at order time. Prefer the linked record, fall back
		// to the snapshot so guest and counter orders still show a customer.
		// The admin order page renders first/last name separately, so split the
		// stored single name field rather than making the page handle both shapes.
		const splitName = (full: string) => {
			const parts = (full || "").trim().split(/\s+/).filter(Boolean);
			return {
				first_name: parts[0] || "",
				last_name: parts.slice(1).join(" ") || "",
			};
		};

		let customerData: {
			id: string | null;
			name: string;
			first_name: string;
			last_name: string;
			email: string;
			phone: string | null;
		} | null = null;

		if (order.customer_id) {
			const { data: customer } = await supabase
				.from("customers")
				.select("id, name, email, phone")
				.eq("id", order.customer_id)
				.maybeSingle();
			if (customer) {
				const name = customer.name || order.customer_name || "";
				customerData = {
					id: customer.id,
					name,
					...splitName(name),
					email: customer.email || order.customer_email || "",
					phone: customer.phone || order.customer_phone || null,
				};
			}
		}

		if (!customerData && (order.customer_name || order.customer_phone)) {
			const name = order.customer_name || "";
			customerData = {
				id: null,
				name,
				...splitName(name),
				email: order.customer_email || "",
				phone: order.customer_phone || null,
			};
		}

		// Get order items — product_name/variation_name are snapshotted at order
		// time; products is joined only to recover a current image.
		const { data: items, error: itemsError } = await supabase
			.from("order_items")
			.select(
				"id, quantity, unit_price, total, product_id, variation_id, product_name, variation_name, serial_number, imei_1, warranty_period",
			)
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
			shipping_amount: order.shipping_amount,
			discount_amount: order.discount_amount,
			payment_method: order.payment_method || "unknown",
			shipping_method: order.shipping_method || "standard",
			tracking_number: order.tracking_number,
			source: order.source,
			created_at: order.created_at,
			updated_at: order.updated_at,
			invoice_type: order.invoice_type || "storefront",
			due_amount: order.due_amount ?? 0,
			advance_deducted: order.advance_deducted ?? 0,
			payment_breakdown: order.payment_breakdown || [],
			customer: customerData,
			tax_amount: 0,
			shipping_address: {
				name: order.customer_name || "",
				...splitName(order.customer_name || ""),
				address_line1: order.address_line1 || "",
				address_line2: null,
				city: order.city || "",
				state: "",
				postal_code: "",
				country: "Bangladesh",
				phone: order.customer_phone || null,
				email: order.customer_email || null,
			},
			billing_address: null,
			items: (items || []).map((item: any) => ({
				id: item.id,
				product_name: item.product_name || "Unknown Product",
				variation_name: item.variation_name || null,
				quantity: item.quantity,
				unit_price: item.unit_price,
				total_price: item.total,
				serial_number: item.serial_number || null,
				imei_1: item.imei_1 || null,
				warranty_period: item.warranty_period || null,
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
