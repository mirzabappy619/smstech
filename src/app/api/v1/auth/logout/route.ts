import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";

export async function POST(_request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const { error } = await supabase.auth.signOut();

		if (error) {
			return errorResponse("LOGOUT_FAILED", error.message, 400);
		}

		return jsonResponse({ message: "Logged out successfully" });
	} catch (error) {
		console.error("Logout error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
