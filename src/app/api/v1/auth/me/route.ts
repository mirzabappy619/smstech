import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";
import { splitFullName } from "@/lib/name";

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

		const { first_name, last_name } = splitFullName(profile.full_name);

		return jsonResponse({
			id: profile.id,
			email: profile.email,
			full_name: profile.full_name,
			first_name,
			last_name,
			role: profile.role,
			avatar_url: profile.avatar_url,
			phone: profile.phone,
			// Verification is tracked on the auth record, not the profile row.
			email_verified: Boolean(user.email_confirmed_at),
			created_at: profile.created_at,
		});
	} catch (error) {
		console.error("Get user error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
