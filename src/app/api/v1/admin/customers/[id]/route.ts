import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	notFoundResponse,
	requireAdmin,
} from "@/lib/api-utils";

const updateCustomerSchema = z.object({
	role: z.enum(["customer", "admin", "owner", "delivery"]).optional(),
	is_disabled: z.boolean().optional(),
	disabled_reason: z.string().optional(),
	fraud_status: z.enum(["clean", "suspicious", "spam", "fraud", "blacklisted"]).optional(),
	fraud_reason: z.string().optional(),
	admin_notes: z.string().optional(),
	nfc_card_uid: z.string().optional().nullable(),
	loyalty_tier: z.string().optional(),
	credit_limit: z.number().optional(),
	advance_balance: z.number().optional(),
	outstanding_due: z.number().optional(),
});

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id: customerId } = await params;
		const supabase = await createAdminClient();

		// Check users or customers table
		let { data: customer } = await supabase
			.from("users")
			.select("*")
			.eq("id", customerId)
			.maybeSingle();

		let customerRecord: any = null;

		if (customer) {
			const { data: cRec } = await supabase
				.from("customers")
				.select("*")
				.or(`email.eq.${customer.email},phone.eq.${customer.phone || 'none'}`)
				.maybeSingle();
			customerRecord = cRec;
		} else {
			const { data: cRec } = await supabase
				.from("customers")
				.select("*")
				.eq("id", customerId)
				.maybeSingle();
			customerRecord = cRec;
			if (cRec) {
				customer = {
					id: cRec.id,
					first_name: cRec.name?.split(" ")[0] || "Customer",
					last_name: cRec.name?.split(" ").slice(1).join(" ") || "",
					email: cRec.email || `${cRec.phone}@customer.smstech.bd`,
					phone: cRec.phone,
					role: "customer",
					created_at: cRec.created_at,
					metadata: {}
				} as any;
			}
		}

		if (!customer) {
			return notFoundResponse("Customer");
		}

		// Fetch customer orders
		const { data: orders } = await supabase
			.from("orders")
			.select("id, order_number, total, status, created_at, payment_method, payment_status")
			.or(`user_id.eq.${customer.id},customer_id.eq.${customer.id},customer_phone.eq.${customer.phone || 'none'}`)
			.order("created_at", { ascending: false });

		// Fetch customer double-entry ledger entries
		const { data: ledgers } = await supabase
			.from("party_ledgers")
			.select("*")
			.eq("party_id", customer.id)
			.order("created_at", { ascending: false })
			.limit(20);

		const total_orders = orders?.length || (customerRecord?.total_orders || 0);
		const total_spent = (orders || []).reduce(
			(sum, o) => sum + parseFloat(String(o.total || 0)),
			0
		) || (customerRecord?.total_spent || 0);

		const meta = (customer.metadata as Record<string, any>) || {};

		return jsonResponse({
			...customer,
			customer_code: customerRecord?.customer_code || `CUST-${customer.id.slice(0, 6).toUpperCase()}`,
			nfc_card_uid: customerRecord?.nfc_card_uid || null,
			loyalty_tier: customerRecord?.loyalty_tier || "Silver",
			advance_balance: customerRecord?.advance_balance || 0,
			outstanding_due: customerRecord?.outstanding_due || 0,
			credit_limit: customerRecord?.credit_limit || 50000,
			is_disabled: Boolean(meta.is_disabled),
			disabled_reason: meta.disabled_reason || "",
			disabled_at: meta.disabled_at || null,
			fraud_status: meta.fraud_status || "clean",
			fraud_reason: meta.fraud_reason || "",
			fraud_flagged_at: meta.fraud_flagged_at || null,
			admin_notes: meta.admin_notes || "",
			total_orders,
			total_spent,
			orders: orders || [],
			ledgers: ledgers || [],
		});
	} catch (err: any) {
		console.error("GET Customer Error:", err);
		return errorResponse(
			"Internal server error",
			"INTERNAL_ERROR",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id: customerId } = await params;
		const body = await request.json().catch(() => null);

		const validation = updateCustomerSchema.safeParse(body);
		if (!validation.success) {
			return errorResponse(
				validation.error.errors[0]?.message || "Invalid request data",
				"VALIDATION_ERROR",
				HTTP_STATUS.BAD_REQUEST
			);
		}

		const supabase = await createAdminClient();
		const updates = validation.data;

		// 1. Update customers table if exists
		const customerUpdates: any = {};
		if (updates.nfc_card_uid !== undefined) customerUpdates.nfc_card_uid = updates.nfc_card_uid;
		if (updates.loyalty_tier !== undefined) customerUpdates.loyalty_tier = updates.loyalty_tier;
		if (updates.credit_limit !== undefined) customerUpdates.credit_limit = updates.credit_limit;
		if (updates.advance_balance !== undefined) customerUpdates.advance_balance = updates.advance_balance;
		if (updates.outstanding_due !== undefined) customerUpdates.outstanding_due = updates.outstanding_due;

		if (Object.keys(customerUpdates).length > 0) {
			await supabase.from("customers").update(customerUpdates).eq("id", customerId);
		}

		// 2. Update users table metadata
		const { data: user } = await supabase.from("users").select("metadata").eq("id", customerId).maybeSingle();
		if (user) {
			const existingMeta = (user.metadata as Record<string, any>) || {};
			const newMeta = {
				...existingMeta,
				...(updates.is_disabled !== undefined ? { is_disabled: updates.is_disabled, disabled_reason: updates.disabled_reason, disabled_at: updates.is_disabled ? new Date().toISOString() : null } : {}),
				...(updates.fraud_status !== undefined ? { fraud_status: updates.fraud_status, fraud_reason: updates.fraud_reason, fraud_flagged_at: new Date().toISOString() } : {}),
				...(updates.admin_notes !== undefined ? { admin_notes: updates.admin_notes } : {}),
			};
			await supabase.from("users").update({ metadata: newMeta, ...(updates.role ? { role: updates.role } : {}) }).eq("id", customerId);
		}

		return jsonResponse({ success: true, message: "Customer profile and enterprise credentials updated" });
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to update customer", 500);
	}
}
