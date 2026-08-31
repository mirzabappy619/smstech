import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";
import { joinFullName } from "@/lib/name";

import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "Password must be at least 8 characters"),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	phone: z.string().optional().nullable().refine(val => !val || isValidBDPhone(val), {
		message: BD_PHONE_ERROR_MESSAGE,
	}),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validation = registerSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { email, password, firstName, lastName, phone } = validation.data;
		const supabase = await createServerClient();

		// Create auth user
		const { data: authData, error: authError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					first_name: firstName,
					last_name: lastName,
					phone: phone ? normalizeBDPhone(phone) : null,
				},
			},
		});

		if (authError) {
			if (authError.message.includes("already registered")) {
				return errorResponse("USER_EXISTS", "Email already registered", 409);
			}
			return errorResponse("REGISTRATION_FAILED", authError.message, 400);
		}

		if (!authData.user) {
			return errorResponse(
				"USER_CREATION_FAILED",
				"Failed to create user",
				500,
			);
		}

		// Create user profile using admin client (bypasses RLS)
		const adminSupabase = await createAdminClient();
		const { data: profileData, error: profileError } = await adminSupabase
			.from("users")
			.insert({
				// The users table stores one full_name column and has no
				// email_verified flag; verification lives on the auth record.
				auth_id: authData.user.id,
				email,
				full_name: joinFullName(firstName, lastName),
				phone: phone ? normalizeBDPhone(phone) : null,
				role: "customer",
			})
			.select()
			.single();

		if (profileError) {
			// Without a profile row the account cannot own orders, addresses or a
			// wishlist, so fail loudly rather than returning a half-made account.
			console.error("Profile creation error:", profileError);
			return errorResponse(
				"PROFILE_CREATION_FAILED",
				"Account created but profile setup failed. Please contact support.",
				500,
			);
		}

		return jsonResponse({
			user: {
				id: profileData?.id || authData.user.id,
				email: authData.user.email,
				first_name: firstName,
				last_name: lastName,
				role: "customer",
			},
			message:
				"Registration successful. Please check your email to verify your account.",
		});
	} catch (error) {
		console.error("Register error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
