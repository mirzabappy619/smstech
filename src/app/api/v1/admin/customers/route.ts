import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	paginatedResponse,
	requireAdmin,
	parsePagination
} from "@/lib/api-utils";
import { splitFullName } from "@/lib/name";

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const { page, limit, offset } = parsePagination(searchParams);
		const search = searchParams.get("search");
		const role = searchParams.get("role");
		const statusFilter = searchParams.get("status"); // active | disabled | all
		const fraudFilter = searchParams.get("fraud_status"); // clean | suspicious | spam | fraud | blacklisted | all

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

		// The disabled and fraud flags live in the metadata JSON. Filtering them
		// in the database rather than in JS keeps the page slice and the total
		// count in agreement — filtering after the fetch reported the unfiltered
		// total, so the pager showed pages that did not exist.
		if (statusFilter && statusFilter !== "all") {
			query =
				statusFilter === "disabled"
					? query.eq("metadata->>is_disabled", "true")
					: query.or(
							"metadata->>is_disabled.is.null,metadata->>is_disabled.eq.false"
						);
		}

		if (fraudFilter && fraudFilter !== "all") {
			// A customer with no fraud_status recorded counts as clean.
			query =
				fraudFilter === "clean"
					? query.or(
							"metadata->>fraud_status.is.null,metadata->>fraud_status.eq.clean"
						)
					: query.eq("metadata->>fraud_status", fraudFilter);
		}

		// Page in the database. This previously fetched every user row and sliced
		// in memory, so the whole table was loaded on every request.
		const { data: users, error, count } = await query.range(offset, offset + limit - 1);

		if (error) {
			console.error("Fetch Customers List Error:", error);
			return errorResponse(
				"CUSTOMERS_FETCH_FAILED",
				"Failed to fetch customers",
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			);
		}

		const pageUsers = (users || []).map((user) => {
			const meta = (user.metadata as Record<string, unknown>) || {};
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
				disabled_reason: (meta.disabled_reason as string) || "",
				fraud_status: (meta.fraud_status as string) || "clean",
				fraud_reason: (meta.fraud_reason as string) || "",
				admin_notes: (meta.admin_notes as string) || "",
			};
		});

		// Order stats for the whole page in two queries. This ran one query per
		// customer before — and against orders.user_id, a column that does not
		// exist, so every customer silently showed zero orders and zero spend.
		// Orders hang off customers, which link back to users via user_id.
		const userIds = pageUsers.map((u) => u.id);
		const statsByUser = new Map<
			string,
			{ total_orders: number; total_spent: number; last_order_date: string | null }
		>();

		if (userIds.length > 0) {
			const { data: customerRows } = await supabase
				.from("customers")
				.select("id, user_id")
				.in("user_id", userIds);

			const userIdByCustomer = new Map<string, string>(
				(customerRows || []).map((c) => [c.id as string, c.user_id as string]),
			);

			if (userIdByCustomer.size > 0) {
				const { data: orders } = await supabase
					.from("orders")
					.select("customer_id, total, created_at")
					.in("customer_id", [...userIdByCustomer.keys()]);

				for (const order of orders || []) {
					const ownerId = userIdByCustomer.get(order.customer_id as string);
					if (!ownerId) continue;

					const stat = statsByUser.get(ownerId) ?? {
						total_orders: 0,
						total_spent: 0,
						last_order_date: null,
					};
					stat.total_orders += 1;
					stat.total_spent += Number(order.total) || 0;
					if (
						!stat.last_order_date ||
						new Date(order.created_at) > new Date(stat.last_order_date)
					) {
						stat.last_order_date = order.created_at;
					}
					statsByUser.set(ownerId, stat);
				}
			}
		}

		const customersWithStats = pageUsers.map((user) => ({
			...user,
			...(statsByUser.get(user.id) ?? {
				total_orders: 0,
				total_spent: 0,
				last_order_date: null,
			}),
		}));

		return paginatedResponse(customersWithStats, page, limit, count ?? 0);
	} catch (err: any) {
		console.error("GET Customers List Exception:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
