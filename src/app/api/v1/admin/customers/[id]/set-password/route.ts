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

const setPasswordSchema = z.object({
	password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id: customerId } = await params;
		const body = await request.json().catch(() => null);

		const validation = setPasswordSchema.safeParse(body);
		if (!validation.success) {
			return errorResponse(
				"VALIDATION_ERROR",
				validation.error.errors[0]?.message || "Invalid password",
				HTTP_STATUS.BAD_REQUEST
			);
		}

		const supabase = await createAdminClient();

		// Fetch customer to get auth_id and email
		const { data: customer, error: fetchError } = await supabase
			.from("users")
			.select("id, auth_id, email")
			.eq("id", customerId)
			.single();

		if (fetchError || !customer) {
			return notFoundResponse("Customer");
		}

		const authUserId = customer.auth_id || customer.id;

		// Update password in Supabase Auth
		const { error: updateError } = await supabase.auth.admin.updateUserById(
			authUserId,
			{ password: validation.data.password }
		);

		if (updateError) {
			console.error("Set password error:", updateError);
			return errorResponse(
				"SET_PASSWORD_FAILED",
				updateError.message || "Failed to set password",
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			);
		}

		return jsonResponse({
			message: "Password updated successfully",
			customer_id: customerId,
		});
	} catch (err: any) {
		console.error("Set password exception:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
