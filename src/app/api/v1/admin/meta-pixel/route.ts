/**
 * Meta Pixel Settings API
 * Fetch and update Meta Pixel settings
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/app/api-utils";
import { requireAdmin } from "@/lib/api-utils";
import { z } from "zod";

const updateSettingsSchema = z.object({
	pixel_id: z.string().min(1, "Pixel ID is required"),
	access_token: z.string().optional().nullable(),
	dataset_id: z.string().optional().nullable(),
	api_version: z.string().optional().nullable(),
	test_event_code: z.string().optional().nullable(),
	enabled: z.boolean(),
	fire_purchase_on_confirmed: z.boolean(),
	enabled_events: z.array(
		z.enum([
			"PageView",
			"ViewContent",
			"AddToCart",
			"InitiateCheckout",
			"Purchase",
			"AddPaymentInfo",
			"Lead",
			"CompleteRegistration",
			"Search",
		]),
	),
	test_mode: z.boolean(),
});

export async function GET(request: NextRequest) {
	try {
		// Validate admin authorization
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();

		// Fetch settings
		const { data, error } = await supabase
			.from("meta_pixel_settings")
			.select("*")
			.single();

		if (error && error.code !== "PGRST116") {
			console.error("Error fetching Meta Pixel settings:", error);
			return errorResponse("FETCH_ERROR", "Failed to fetch settings", 500);
		}

		// If no settings exist, return default
		if (!data) {
			return successResponse({
				settings: {
					pixel_id: "",
					access_token: null,
					dataset_id: null,
					api_version: "v18.0",
					test_event_code: null,
					enabled: false,
					fire_purchase_on_confirmed: false,
					enabled_events: [
						"PageView",
						"ViewContent",
						"AddToCart",
						"InitiateCheckout",
						"Purchase",
					],
					test_mode: false,
				},
			});
		}

		return successResponse({ settings: data });
	} catch (error) {
		console.error("Error in Meta Pixel settings GET:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

export async function PUT(request: NextRequest) {
	try {
		// Validate admin authorization
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const body = await request.json();

		// Validate request body
		const validation = updateSettingsSchema.safeParse(body);
		if (!validation.success) {
			return errorResponse("VALIDATION_ERROR", "Invalid request data", 400);
		}

		const supabase = await createAdminClient();

		// Base fields that always exist (original migration 004)
		const baseFields = {
			pixel_id: validation.data.pixel_id,
			access_token: validation.data.access_token,
			enabled: validation.data.enabled,
			fire_purchase_on_confirmed: validation.data.fire_purchase_on_confirmed,
			enabled_events: validation.data.enabled_events,
			test_mode: validation.data.test_mode,
		};

		// Extended fields added by migration 007 — may not exist yet
		const extendedFields = {
			dataset_id: validation.data.dataset_id || null,
			api_version: validation.data.api_version || "v18.0",
			test_event_code: validation.data.test_event_code || null,
		};

		// Check if settings already exist
		const { data: existingSettings } = await supabase
			.from("meta_pixel_settings")
			.select("id")
			.single();

		let result;
		if (existingSettings) {
			// --- Attempt 1: full update with CAPI fields ---
			const { data, error } = await supabase
				.from("meta_pixel_settings")
				.update({ ...baseFields, ...extendedFields })
				.eq("id", existingSettings.id)
				.select()
				.single();

			if (error) {
				// Column likely missing (migration 007 not yet run) — fall back to base fields only
				console.warn(
					"[meta-pixel] Full update failed, retrying with base fields only.",
					"Run supabase/migrations/007_capi_settings.sql to enable CAPI fields.",
					error.message,
				);

				const { data: fallbackData, error: fallbackError } = await supabase
					.from("meta_pixel_settings")
					.update(baseFields)
					.eq("id", existingSettings.id)
					.select()
					.single();

				if (fallbackError) {
					console.error("Error updating Meta Pixel settings (fallback):", fallbackError);
					return errorResponse("UPDATE_ERROR", "Failed to update settings: " + fallbackError.message, 500);
				}
				result = fallbackData;
			} else {
				result = data;
			}
		} else {
			// --- Attempt 1: insert with CAPI fields ---
			const { data, error } = await supabase
				.from("meta_pixel_settings")
				.insert({ ...baseFields, ...extendedFields })
				.select()
				.single();

			if (error) {
				// Fall back to inserting base fields only
				console.warn(
					"[meta-pixel] Full insert failed, retrying with base fields only.",
					"Run supabase/migrations/007_capi_settings.sql to enable CAPI fields.",
					error.message,
				);

				const { data: fallbackData, error: fallbackError } = await supabase
					.from("meta_pixel_settings")
					.insert(baseFields)
					.select()
					.single();

				if (fallbackError) {
					console.error("Error creating Meta Pixel settings (fallback):", fallbackError);
					return errorResponse("CREATE_ERROR", "Failed to create settings: " + fallbackError.message, 500);
				}
				result = fallbackData;
			} else {
				result = data;
			}
		}

		return successResponse({
			message: "Settings updated successfully",
			settings: result,
		});
	} catch (error) {
		console.error("Error in Meta Pixel settings PUT:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

