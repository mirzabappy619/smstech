import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validation = loginSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { email, password } = validation.data;
		const supabase = await createServerClient();

		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return errorResponse("AUTH_FAILED", error.message, 401);
		}

		// Read the profile with the admin client: RLS on `users` hides the row
		// from the freshly signed-in session, which silently downgraded every
		// admin to the "customer" fallback below.
		const adminSupabase = await createAdminClient();
		const { data: profile } = await adminSupabase
			.from("users")
			.select("id, auth_id, email, full_name, phone, role, is_active, avatar_url, metadata, created_at")
			.eq("auth_id", data.user.id)
			.maybeSingle();

		const meta = (profile?.metadata as Record<string, any>) || {};
		if (profile && profile.is_active === false) {
			await supabase.auth.signOut();
			return errorResponse(
				"ACCOUNT_DISABLED",
				"Your account has been disabled by an administrator.",
				403,
			);
		}
		if (meta.is_disabled) {
			await supabase.auth.signOut();
			return errorResponse(
				"ACCOUNT_DISABLED",
				meta.disabled_reason
					? `Account disabled: ${meta.disabled_reason}`
					: "Your account has been disabled by an administrator.",
				403
			);
		}

		return jsonResponse({
			user: profile || {
				id: data.user.id,
				email: data.user.email,
				role: "customer",
			},
			session: {
				access_token: data.session.access_token,
				refresh_token: data.session.refresh_token,
				expires_at: data.session.expires_at,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
