import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, requireAdmin } from "@/lib/api-utils";

// GET /api/v1/admin/landing-pages/check-slug/[slug]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
) {
	try {
		const { slug } = await params;
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Check if slug exists
		const { data, error } = await supabase
			.from("landing_pages")
			.select("id, title, status")
			.eq("slug", slug)
			.single();

		if (error && error.code !== "PGRST116") {
			console.error("Error checking slug:", error);
			return errorResponse("CHECK_FAILED", "Failed to check slug", 500);
		}

		return successResponse({
			available: !data, // slug is available if no existing page found
			exists: !!data,
			page: data || null,
		});
	} catch (error) {
		console.error("Check slug error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
