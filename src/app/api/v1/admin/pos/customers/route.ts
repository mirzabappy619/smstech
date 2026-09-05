import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { generatePartyCode, validateParty } from "@/lib/parties";

/** Enough rows to pick from, few enough to read at a glance mid-sale. */
const SUGGESTION_LIMIT = 8;

const CUSTOMER_COLUMNS =
	"id, customer_code, name, phone, email, loyalty_tier, advance_balance, outstanding_due, credit_limit, customer_type, company_name";

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

/**
 * GET /api/v1/admin/pos/customers?q=      type-ahead suggestions
 * GET /api/v1/admin/pos/customers?id=...  one customer, with what the till
 *                                         needs to settle against them
 *
 * The list form always returns a list — an exact single match is still a list
 * of one, so the cashier confirms who they are billing rather than having a
 * customer silently attached to the sale. With no query it returns the most
 * recently added customers, which is what the picker shows on open.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "pos:access");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const q = searchParams.get("q")?.trim() || "";
		const id = searchParams.get("id")?.trim();

		const supabase = await getSupabaseServerClient();

		if (id) {
			const { data: customer, error: customerError } = await supabase
				.from("customers")
				.select(CUSTOMER_COLUMNS)
				.eq("id", id)
				.maybeSingle();

			if (customerError) throw customerError;
			if (!customer) {
				return NextResponse.json(
					{ success: false, error: "That customer no longer exists." },
					{ status: 404 },
				);
			}

			// Open pre-bookings settle part of the bill at the till, so they
			// travel with the customer rather than being fetched separately.
			const { data: preBookings } = await supabase
				.from("pre_bookings")
				.select(
					"id, booking_number, total_price, advance_paid, remaining_due, queue_priority, status",
				)
				.eq("customer_id", customer.id)
				.in("status", ["queued", "allocated", "ready_for_pickup"]);

			const { data: recentOrders } = await supabase
				.from("orders")
				.select("id, order_number, total, created_at, status, payment_status")
				.eq("customer_id", customer.id)
				.order("created_at", { ascending: false })
				.limit(5);

			return NextResponse.json({
				success: true,
				data: {
					customer,
					preBookings: preBookings || [],
					recentOrders: recentOrders || [],
				},
			});
		}

		let query = supabase
			.from("customers")
			.select(CUSTOMER_COLUMNS)
			.order("created_at", { ascending: false })
			.limit(SUGGESTION_LIMIT);

		const filter = buildIlikeOr(["name", "phone", "customer_code", "company_name"], q);
		if (filter) query = query.or(filter);

		const { data, error } = await query;
		if (error) throw error;

		return NextResponse.json({
			success: true,
			data: { customers: data || [], query: q },
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS customer search failed:", message);
		return NextResponse.json(
			{ success: false, error: "Customer lookup failed" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/v1/admin/pos/customers
 *
 * Register a walk-in without leaving the till. Same validation and same code
 * format as the Customer Management screen — this is a shortcut to that
 * record, not a second kind of customer.
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "customers:edit");
		if (auth.error) return auth.error;

		const body = await request.json();

		const validated = validateParty("customer", { ...body, customer_type: "retail" });
		if ("error" in validated) return badRequest(validated.error);
		const party = validated.value;

		const supabase = await getSupabaseServerClient();

		// A phone number already on file is the same person at the counter.
		// Handing back the existing record beats creating a duplicate whose
		// dues and advances live on the other row.
		const { data: existing } = await supabase
			.from("customers")
			.select(CUSTOMER_COLUMNS)
			.eq("phone", party.phone)
			.limit(1)
			.maybeSingle();

		if (existing) {
			return NextResponse.json({
				success: true,
				data: { customer: existing, already_registered: true },
			});
		}

		const { data: customer, error } = await supabase
			.from("customers")
			.insert({
				name: party.name,
				customer_code: generatePartyCode("customer"),
				phone: party.phone,
				email: party.email,
				address_line1: party.address,
				customer_type: "retail",
				credit_limit: party.credit_limit,
				outstanding_due: 0,
				advance_balance: 0,
				total_orders: 0,
				total_spent: 0,
			})
			.select(CUSTOMER_COLUMNS)
			.single();

		if (error) {
			if (error.code === "23505") {
				return badRequest("That customer code is already taken. Try again.", 409);
			}
			throw error;
		}

		return NextResponse.json(
			{ success: true, data: { customer, already_registered: false } },
			{ status: 201 },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS customer create failed:", message);
		return NextResponse.json(
			{ success: false, error: "Could not register that customer" },
			{ status: 500 },
		);
	}
}
