import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	paginatedResponse,
	requireAdmin,
} from "@/lib/api-utils";
import { splitFullName } from "@/lib/name";

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "20");
		const search = searchParams.get("search");
		const role = searchParams.get("role");
		const statusFilter = searchParams.get("status"); // active | disabled | all
		const fraudFilter = searchParams.get("fraud_status"); // clean | suspicious | spam | fraud | blacklisted | all
		const offset = (page - 1) * limit;

		const supabase = await createAdminClient();

		let query = supabase
			.from("users")
			.select(
				"id, auth_id, full_name, email, phone, role, metadata, created_at",
				{ count: "exact" }
			)
			.order("created_at", { ascending: false });

		if (search) {
			query = query.or(
				`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
			);
		}

		if (role && role !== "all") {
			query = query.eq("role", role);
		}

		const { data: users, error, count } = await query;

		if (error) {
			console.error("Fetch Customers List Error:", error);
			return errorResponse(
				"CUSTOMERS_FETCH_FAILED",
				"Failed to fetch customers",
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			);
		}

		// Map metadata fields and calculate order stats
		let formattedCustomers = (users || []).map((user) => {
			const meta = (user.metadata as Record<string, any>) || {};
			const { first_name, last_name } = splitFullName(user.full_name);
			return {
				id: user.id,
				auth_id: user.auth_id,
				first_name,
				last_name,
				email: user.email || "",
				phone: user.phone || null,
				role: user.role || "customer",
				created_at: user.created_at,
				is_disabled: Boolean(meta.is_disabled),
				disabled_reason: meta.disabled_reason || "",
				fraud_status: meta.fraud_status || "clean",
				fraud_reason: meta.fraud_reason || "",
				admin_notes: meta.admin_notes || "",
			};
		});

		// Filter in memory for metadata JSON status and fraud filters
		if (statusFilter && statusFilter !== "all") {
			formattedCustomers = formattedCustomers.filter((c) =>
				statusFilter === "disabled" ? c.is_disabled : !c.is_disabled
			);
		}

		if (fraudFilter && fraudFilter !== "all") {
			formattedCustomers = formattedCustomers.filter(
				(c) => c.fraud_status === fraudFilter
			);
		}

		const totalCount = count !== null ? count : formattedCustomers.length;
		const paginatedCustomers = formattedCustomers.slice(offset, offset + limit);

		// Enrich each customer with order stats
		const customersWithStats = await Promise.all(
			paginatedCustomers.map(async (user) => {
				const { data: orders } = await supabase
					.from("orders")
					.select("total, created_at")
					.eq("user_id", user.id);

				const total_orders = orders?.length || 0;
				const total_spent = (orders || []).reduce(
					(sum, o) => sum + parseFloat(String(o.total || 0)),
					0
				);
				const last_order_date =
					orders && orders.length > 0
						? [...orders].sort(
								(a, b) =>
									new Date(b.created_at).getTime() -
									new Date(a.created_at).getTime()
							)[0].created_at
						: null;

				return { ...user, total_orders, total_spent, last_order_date };
			})
		);

		return paginatedResponse(customersWithStats, page, limit, totalCount);
	} catch (err: any) {
		console.error("GET Customers List Exception:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
