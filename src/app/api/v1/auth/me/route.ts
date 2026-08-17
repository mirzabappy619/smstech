import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return errorResponse("UNAUTHENTICATED", "Not authenticated", 401);
		}

		// Get full user profile
		const { data: profile, error: profileError } = await supabase
			.from("users")
			.select("*")
			.eq("auth_id", user.id)
			.single();

		if (profileError || !profile) {
			// Return basic user info if profile not found
			return jsonResponse({
				id: user.id,
				email: user.email,
				role: "customer",
			});
		}

		return jsonResponse({
			id: profile.id,
			email: profile.email,
			first_name: profile.first_name,
			last_name: profile.last_name,
			role: profile.role,
			avatar_url: profile.avatar_url,
			phone: profile.phone,
			email_verified: profile.email_verified,
			created_at: profile.created_at,
		});
	} catch (error) {
		console.error("Get user error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
