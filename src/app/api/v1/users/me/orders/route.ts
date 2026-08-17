import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { errorResponse, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
		const status = searchParams.get("status");

		// Get user's internal ID from their auth_id
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (!userData) {
			return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
		}

		let query = supabase
			.from("orders")
			.select(
				"id, order_number, status, payment_status, total, currency, created_at, order_items(count)",
				{ count: "exact" },
			)
			.eq("user_id", userData.id)
			.order("created_at", { ascending: false });

		if (status) {
			query = query.eq("status", status);
		}

		const from = (page - 1) * limit;
		const to = from + limit - 1;
		query = query.range(from, to);

		const { data: orders, count, error } = await query;

		if (error) {
			return errorResponse("FETCH_FAILED", "Failed to fetch orders", 500);
		}

		// Transform to include items_count
		const transformedOrders = orders?.map((order) => ({
			id: order.id,
			order_number: order.order_number,
			status: order.status,
			payment_status: order.payment_status,
			total: order.total,
			currency: order.currency,
			created_at: order.created_at,
			items_count: Array.isArray(order.order_items)
				? order.order_items.length
				: 0,
		}));

		return paginatedResponse(transformedOrders || [], page, limit, count || 0);
	} catch (error) {
		console.error("Get user orders error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
