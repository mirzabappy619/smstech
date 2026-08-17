import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils";

// POST /api/v1/admin/landing-pages/[id]/unpublish
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { user, error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Get user info from database
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (!userData) {
			return errorResponse("USER_NOT_FOUND", "User not found", 404);
		}

		// Update status to draft
		const { data, error } = await supabase
			.from("landing_pages")
			.update({
				status: "draft",
				updated_by: userData.id,
			})
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error unpublishing landing page:", error);
			return errorResponse(
				"UNPUBLISH_FAILED",
				"Failed to unpublish landing page",
				500,
			);
		}

		return successResponse(data);
	} catch (error) {
		console.error("Unpublish landing page error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
