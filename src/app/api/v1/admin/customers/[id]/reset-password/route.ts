import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	notFoundResponse,
	requireAdmin,
} from "@/lib/api-utils";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id: customerId } = await params;
		const supabase = await createAdminClient();

		// Fetch customer email
		const { data: customer, error: fetchError } = await supabase
			.from("users")
			.select("id, auth_id, email, first_name, last_name")
			.eq("id", customerId)
			.single();

		if (fetchError || !customer || !customer.email) {
			return notFoundResponse("Customer or Customer Email");
		}

		// Generate recovery link using Supabase Admin Auth
		const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const { data: linkData, error: linkError } =
			await supabase.auth.admin.generateLink({
				type: "recovery",
				email: customer.email,
				options: {
					redirectTo: `${siteUrl}/reset-password`,
				},
			});

		if (linkError) {
			console.error("Reset password link generation error:", linkError);
			return errorResponse(
				"RESET_LINK_FAILED",
				linkError.message || "Failed to generate password reset link",
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			);
		}

		const resetLink = linkData.properties?.action_link || "";

		return jsonResponse({
			message: "Password reset link generated successfully",
			email: customer.email,
			reset_link: resetLink,
		});
	} catch (err: any) {
		console.error("Reset password exception:", err);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR
		);
	}
}
