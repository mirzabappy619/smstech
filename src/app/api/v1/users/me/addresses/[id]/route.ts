import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
} from "@/lib/api-utils";
import { z } from "zod";

const addressSchema = z.object({
	label: z.string().min(1).max(50).optional(),
	street: z.string().min(1).max(255).optional(),
	apartment: z.string().max(100).optional(),
	city: z.string().min(1).max(100).optional(),
	state: z.string().min(1).max(100).optional(),
	postal_code: z.string().min(1).max(20).optional(),
	country: z.string().min(1).max(100).optional(),
	phone: z.string().max(50).optional(),
	is_default: z.boolean().optional(),
});

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		const body = await request.json();
		const validation = addressSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		// Get user's internal ID
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (!userData) {
			return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
		}

		// If this is the default address, unset other defaults
		if (validation.data.is_default) {
			await supabase
				.from("addresses")
				.update({ is_default: false })
				.eq("user_id", userData.id);
		}

		const { data: address, error } = await supabase
			.from("addresses")
			.update(validation.data)
			.eq("id", id)
			.eq("user_id", userData.id)
			.select()
			.single();

		if (error) {
			return errorResponse("UPDATE_FAILED", "Failed to update address", 500);
		}

		if (!address) {
			return errorResponse("NOT_FOUND", "Address not found", 404);
		}

		return successResponse(address);
	} catch (error) {
		console.error("Update address error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		// Get user's internal ID
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (!userData) {
			return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
		}

		const { error } = await supabase
			.from("addresses")
			.delete()
			.eq("id", id)
			.eq("user_id", userData.id);

		if (error) {
			return errorResponse("DELETE_FAILED", "Failed to delete address", 500);
		}

		return successResponse({ message: "Address deleted successfully" });
	} catch (error) {
		console.error("Delete address error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
