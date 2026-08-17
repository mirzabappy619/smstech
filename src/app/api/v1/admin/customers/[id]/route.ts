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

		const { data: customer, error: fetchError } = await supabase
			.from("users")
			.select("*")
			.eq("id", customerId)
			.single();

		if (fetchError || !customer) {
			return notFoundResponse("Customer");
		}

		// Fetch customer orders
		const { data: orders } = await supabase
			.from("orders")
			.select("id, order_number, total, status, created_at, payment_method, payment_status")
			.eq("user_id", customerId)
			.order("created_at", { ascending: false });

		const total_orders = orders?.length || 0;
		const total_spent = (orders || []).reduce(
			(sum, o) => sum + parseFloat(String(o.total || 0)),
			0
		);

		const meta = (customer.metadata as Record<string, any>) || {};

		return jsonResponse({
			...customer,
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
		});
	} catch (err: any) {
		console.error("GET Customer Error:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
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
				"VALIDATION_ERROR",
				validation.error.errors[0]?.message || "Invalid request data",
				HTTP_STATUS.BAD_REQUEST
			);
		}

		const supabase = await createAdminClient();

		// Fetch existing user to merge metadata
		const { data: existingUser, error: fetchError } = await supabase
			.from("users")
			.select("id, auth_id, role, metadata")
			.eq("id", customerId)
			.single();

		if (fetchError || !existingUser) {
			return notFoundResponse("Customer");
		}

		const currentMeta = (existingUser.metadata as Record<string, any>) || {};
		const updatedMeta = { ...currentMeta };

		const updatePayload: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (validation.data.role !== undefined) {
			updatePayload.role = validation.data.role;
		}

		if (validation.data.is_disabled !== undefined) {
			updatedMeta.is_disabled = validation.data.is_disabled;
			if (validation.data.is_disabled) {
				updatedMeta.disabled_at = new Date().toISOString();
				if (validation.data.disabled_reason !== undefined) {
					updatedMeta.disabled_reason = validation.data.disabled_reason;
				}
			} else {
				updatedMeta.disabled_at = null;
				updatedMeta.disabled_reason = "";
			}

			// Sync ban with Supabase Auth admin
			const authId = existingUser.auth_id || existingUser.id;
			try {
				await supabase.auth.admin.updateUserById(authId, {
					ban_duration: validation.data.is_disabled ? "876000h" : "none",
				});
			} catch (authErr) {
				console.warn("Could not sync ban_duration with Supabase Auth:", authErr);
			}
		}

		if (validation.data.fraud_status !== undefined) {
			updatedMeta.fraud_status = validation.data.fraud_status;
			updatedMeta.fraud_flagged_at = new Date().toISOString();
			if (validation.data.fraud_reason !== undefined) {
				updatedMeta.fraud_reason = validation.data.fraud_reason;
			}
		}

		if (validation.data.admin_notes !== undefined) {
			updatedMeta.admin_notes = validation.data.admin_notes;
		}

		updatePayload.metadata = updatedMeta;

		const { data: updatedUser, error: updateError } = await supabase
			.from("users")
			.update(updatePayload)
			.eq("id", customerId)
			.select("*")
			.single();

		if (updateError || !updatedUser) {
			console.error("Update Customer Error:", updateError);
			return errorResponse(
				"UPDATE_FAILED",
				"Failed to update customer",
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			);
		}

		return jsonResponse({
			...updatedUser,
			is_disabled: Boolean(updatedMeta.is_disabled),
			disabled_reason: updatedMeta.disabled_reason || "",
			fraud_status: updatedMeta.fraud_status || "clean",
			fraud_reason: updatedMeta.fraud_reason || "",
			admin_notes: updatedMeta.admin_notes || "",
		});
	} catch (err: any) {
		console.error("PATCH Customer Error:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
