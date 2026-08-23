/**
 * Admin Settings API
 * Manage store settings, branch addresses, social media links & general config
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, jsonResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

const nullableString = (schema: z.ZodString) =>
	z.union([schema, z.literal(""), z.null()]).optional();

const settingsSchema = z.object({
	store_name: z.string().min(1).max(100).optional(),
	store_email: nullableString(z.string().email()),
	store_phone: z.string().max(100).nullable().optional(),
	store_address: z.string().max(500).nullable().optional(),
	store_currency: z.string().length(3).optional(),
	store_timezone: z.string().max(50).optional(),
	tax_rate: z.number().min(0).max(100).optional(),
	shipping_enabled: z.boolean().optional(),
	free_shipping_threshold: z.number().min(0).optional(),
	default_shipping_cost: z.number().min(0).optional(),
	inventory_tracking: z.boolean().optional(),
	low_stock_threshold: z.number().min(0).optional(),
	allow_guest_checkout: z.boolean().optional(),
	order_prefix: z.string().max(10).optional(),
	notify_on_order: z.boolean().optional(),
	notify_on_low_stock: z.boolean().optional(),
	social_facebook: nullableString(z.string().url()),
	social_instagram: nullableString(z.string().url()),
	social_twitter: nullableString(z.string().url()),
	social_youtube: nullableString(z.string().url()),
	social_whatsapp: nullableString(z.string()),
	maintenance_mode: z.boolean().optional(),
	homepage_settings: z.record(z.unknown()).optional(),
	shipping_methods: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				description: z.string().optional().default(""),
				price: z.number().min(0),
				is_active: z.boolean().default(true),
			}),
		)
		.optional(),
});

const defaultSettings = {
	store_name: "SMSTech BD",
	store_email: "info@smstech.bd",
	store_phone: "01781485588, 01723249598",
	store_address: "Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205",
	store_currency: "BDT",
	store_timezone: "Asia/Dhaka",
	tax_rate: 0,
	shipping_enabled: true,
	free_shipping_threshold: 0,
	default_shipping_cost: 60,
	inventory_tracking: true,
	low_stock_threshold: 10,
	allow_guest_checkout: true,
	order_prefix: "SMST",
	notify_on_order: true,
	notify_on_low_stock: true,
	social_facebook: "https://facebook.com/smstech.bd",
	social_instagram: "https://instagram.com/smstech.bd",
	social_youtube: "https://youtube.com/@smstech",
	social_whatsapp: "https://wa.me/8801781485588",
	social_twitter: "https://twitter.com/smstechbd",
	maintenance_mode: false,
};

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();

		const { data: settings, error } = await supabase
			.from("store_settings")
			.select("*")
			.single();

		if (error && error.code !== "PGRST116") {
			console.error("Error fetching settings:", error);
			return jsonResponse({ settings: defaultSettings });
		}

		const mergedSettings = { ...defaultSettings, ...(settings || {}) };

		return jsonResponse({
			settings: mergedSettings,
		});
	} catch (error) {
		console.error("Settings GET error:", error);
		return jsonResponse({ settings: defaultSettings });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const body = await request.json();
		const validation = settingsSchema.safeParse(body);

		if (!validation.success) {
			return errorResponse(
				"VALIDATION_ERROR",
				validation.error.errors.map((e) => e.message).join(", "),
				400,
			);
		}

		const supabase = await createAdminClient();

		const { data: existing } = await supabase
			.from("store_settings")
			.select("id")
			.single();

		let result;

		if (existing) {
			result = await supabase
				.from("store_settings")
				.update({
					...validation.data,
					updated_at: new Date().toISOString(),
				})
				.eq("id", existing.id)
				.select()
				.single();
		} else {
			result = await supabase
				.from("store_settings")
				.insert({
					...defaultSettings,
					...validation.data,
				})
				.select()
				.single();
		}

		if (result.error) {
			console.error("Error saving settings:", result.error);
			return errorResponse("DB_ERROR", "Failed to save settings", 500);
		}

		return jsonResponse({
			success: true,
			settings: result.data,
		});
	} catch (error) {
		console.error("Settings PUT error:", error);
		return errorResponse("INTERNAL_ERROR", "Failed to save settings", 500);
	}
}
