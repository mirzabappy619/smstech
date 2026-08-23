import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const redirectTo = searchParams.get("redirectTo") || "/";

	if (code) {
		const supabase = await createServerClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Successful auth — redirect to intended destination
			return NextResponse.redirect(new URL(redirectTo, origin));
		}

		console.error("[Auth Callback] Code exchange error:", error.message);
	}

	// If no code or exchange failed, redirect to login with error
	return NextResponse.redirect(
		new URL("/login?error=auth_callback_failed", origin),
	);
}
