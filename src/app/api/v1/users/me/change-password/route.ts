import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

export async function POST(request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		const body = await request.json();
		const validation = changePasswordSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		// Verify current password by attempting to sign in
		const { error: signInError } = await supabase.auth.signInWithPassword({
			email: user.email!,
			password: validation.data.currentPassword,
		});

		if (signInError) {
			return errorResponse(
				"INVALID_PASSWORD",
				"Current password is incorrect",
				400,
			);
		}

		// Update password
		const { error: updateError } = await supabase.auth.updateUser({
			password: validation.data.newPassword,
		});

		if (updateError) {
			return errorResponse("UPDATE_FAILED", updateError.message, 500);
		}

		return successResponse({ message: "Password updated successfully" });
	} catch (error) {
		console.error("Change password error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
