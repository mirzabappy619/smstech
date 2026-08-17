/**
 * POST /api/v1/admin/meta-pixel/test
 * Send a test conversion event directly to Facebook Conversions API
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/app/api-utils";
import { requireAdmin } from "@/lib/api-utils";
import { z } from "zod";

const testEventSchema = z.object({
	event_name: z
		.enum([
			"PageView",
			"ViewContent",
			"AddToCart",
			"InitiateCheckout",
			"Purchase",
			"AddPaymentInfo",
			"Lead",
			"CompleteRegistration",
			"Search",
		])
		.default("Purchase"),
	value: z.number().optional().default(10),
	currency: z.string().default("BDT"),
	email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const body = await request.json();
		const validation = testEventSchema.safeParse(body);
		if (!validation.success) {
			return errorResponse("VALIDATION_ERROR", "Invalid request data", 400);
		}

		const supabase = await createAdminClient();
		const { data: settings, error: settingsError } = await supabase
			.from("meta_pixel_settings")
			.select("*")
			.single();

		if (settingsError || !settings) {
			return errorResponse(
				"SETTINGS_NOT_FOUND",
				"Meta Pixel settings not configured",
				404,
			);
		}

		if (!settings.access_token) {
			return errorResponse(
				"NO_ACCESS_TOKEN",
				"Access token is required to send server-side events",
				400,
			);
		}

		// Use dataset_id if set, else fall back to pixel_id
		const datasetId = settings.dataset_id || settings.pixel_id;
		const apiVersion = settings.api_version || "v18.0";
		const token = settings.access_token;

		// Hash the test email if provided
		let hashedEmail: string | undefined;
		if (validation.data.email) {
			const encoder = new TextEncoder();
			const data = encoder.encode(
				validation.data.email.toLowerCase().trim(),
			);
			const hashBuffer = await crypto.subtle.digest("SHA-256", data);
			hashedEmail = Array.from(new Uint8Array(hashBuffer))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
		}

		const eventPayload = {
			data: [
				{
					event_name: validation.data.event_name,
					event_time: Math.floor(Date.now() / 1000),
					action_source: "website",
					event_source_url: process.env.NEXT_PUBLIC_SITE_URL || "https://example.com",
					user_data: {
						em: hashedEmail ? [hashedEmail] : undefined,
						ph: [null],
					},
					custom_data: {
						currency: validation.data.currency,
						value: validation.data.value.toString(),
					},
				},
			],
			// Use test_event_code if in test_mode or test_event_code is set
			test_event_code: settings.test_mode
				? settings.test_event_code || "TEST12345"
				: undefined,
		};

		console.log("[CAPI Test] Sending to Facebook:", {
			endpoint: `https://graph.facebook.com/${apiVersion}/${datasetId}/events`,
			payload: JSON.stringify(eventPayload, null, 2),
		});

		const fbResponse = await fetch(
			`https://graph.facebook.com/${apiVersion}/${datasetId}/events?access_token=${token}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(eventPayload),
			},
		);

		const fbResult = await fbResponse.json();

		if (!fbResponse.ok) {
			console.error("[CAPI Test] Facebook API error:", fbResult);
			return errorResponse(
				"FB_API_ERROR",
				fbResult?.error?.message || "Facebook API returned an error",
				fbResponse.status,
			);
		}

		return successResponse({
			message: "Test event sent successfully",
			event_name: validation.data.event_name,
			events_received: fbResult.events_received,
			fbtrace_id: fbResult.fbtrace_id,
			endpoint: `https://graph.facebook.com/${apiVersion}/${datasetId}/events`,
			payload: eventPayload,
			fb_response: fbResult,
		});
	} catch (error) {
		console.error("[CAPI Test] Internal error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
