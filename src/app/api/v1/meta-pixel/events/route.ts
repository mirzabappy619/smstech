/**
 * POST /api/v1/meta-pixel/events
 * Browser-callable relay that fires a server-side CAPI event.
 * Used for ViewContent, AddToCart, InitiateCheckout.
 * The browser sends fbc/fbp cookies + optional user data;
 * the server adds IP, UA, and calls the Meta Conversions API.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { MetaPixelService } from "@/infrastructure/meta-pixel/meta-pixel-service";

const eventSchema = z.object({
  event_name: z.enum([
    "ViewContent",
    "AddToCart",
    "InitiateCheckout",
    "PageView",
    "Search",
    "AddPaymentInfo",
    "Lead",
    "CompleteRegistration",
  ]),
  event_id: z.string().optional(),
  event_source_url: z.string().url().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  external_id: z.string().optional(),
  custom_data: z
    .object({
      value: z.number().optional(),
      currency: z.string().optional(),
      content_ids: z.array(z.string()).optional(),
      content_type: z.string().optional(),
      content_name: z.string().optional(),
      contents: z
        .array(
          z.object({
            id: z.string(),
            quantity: z.number(),
            item_price: z.number().optional(),
          }),
        )
        .optional(),
      num_items: z.number().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("INVALID_JSON", "Invalid JSON body", 400);
    }

    const validation = eventSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        validation.error.errors[0]?.message || "Invalid request",
        400,
      );
    }

    const {
      event_name,
      event_id,
      event_source_url,
      fbc,
      fbp,
      external_id,
      custom_data,
    } = validation.data;

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    await MetaPixelService.fireServerEvent({
      event_name,
      event_id,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url,
      action_source: "website",
      user_data: {
        fbc,
        fbp,
        external_id,
        client_ip_address: clientIp,
        client_user_agent: userAgent,
      },
      custom_data,
    });

    return successResponse({ received: true });
  } catch {
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
