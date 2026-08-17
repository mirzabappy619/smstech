import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
	HTTP_STATUS,
} from "@/lib/api-utils";
import { z } from "zod";

const addressSchema = z.object({
	label: z.string().min(1).max(50).optional(),
	street: z.string().min(1).max(255),
	apartment: z.string().max(100).optional(),
	city: z.string().min(1).max(100),
	state: z.string().min(1).max(100),
	postal_code: z.string().min(1).max(20),
	country: z.string().min(1).max(100),
	phone: z.string().max(50).optional(),
	is_default: z.boolean().optional(),
});

export async function GET() {
	try {
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

		const { data: addresses, error } = await supabase
			.from("addresses")
			.select("*")
			.eq("user_id", userData.id)
			.order("is_default", { ascending: false })
			.order("created_at", { ascending: false });

		if (error) {
			return errorResponse("FETCH_FAILED", "Failed to fetch addresses", 500);
		}

		return successResponse(addresses);
	} catch (error) {
		console.error("Get addresses error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

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
			.insert({
				user_id: userData.id,
				...validation.data,
			})
			.select()
			.single();

		if (error) {
			return errorResponse("CREATE_FAILED", "Failed to create address", 500);
		}

		return successResponse(address, HTTP_STATUS.CREATED);
	} catch (error) {
		console.error("Create address error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
