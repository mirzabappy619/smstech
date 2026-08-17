/**
 * Supabase Edge Function: capi-purchase
 *
 * Triggered by a Supabase Database Webhook when a new row is INSERT-ed into
 * the `orders` table.  Reads all CAPI credentials (Pixel ID, access token,
 * API version, test event code) from the `meta_pixel_settings` table — the
 * same table managed via Admin Panel → Meta Pixel settings page.
 *
 * NO manual secrets are required beyond the two that Supabase injects
 * automatically into every Edge Function:
 *   SUPABASE_URL             – auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY – auto-injected by Supabase
 *
 * Deduplication:
 *   event_id = Order UUID.  The browser Pixel (checkout page) must send the
 *   same value via:
 *     fbq('track', 'Purchase', { ... }, { eventID: orderId })
 *   Meta deduplicates the two signals and counts ONE conversion.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 of a lowercase-trimmed string — required by Meta CAPI */
async function sha256(value: string): Promise<string> {
  const normalized = value.toLowerCase().trim();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  try {
    // ------------------------------------------------------------------
    // 1.  Create Supabase admin client
    //     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically
    //     available in every Supabase Edge Function — no manual setup.
    // ------------------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ------------------------------------------------------------------
    // 2.  Load CAPI settings from the database
    //     These are configured via Admin Panel → Meta Pixel settings.
    //     Fields: pixel_id, access_token, dataset_id, api_version,
    //             test_event_code, enabled, test_mode
    // ------------------------------------------------------------------
    const { data: capiSettings, error: settingsError } = await supabase
      .from("meta_pixel_settings")
      .select(
        "pixel_id, access_token, dataset_id, api_version, test_event_code, enabled, test_mode",
      )
      .single();

    if (settingsError || !capiSettings) {
      console.warn(
        "[capi-purchase] meta_pixel_settings not configured — skipping",
      );
      return jsonResp({ skipped: true, reason: "CAPI not configured" });
    }

    if (!capiSettings.enabled) {
      console.log("[capi-purchase] CAPI disabled in admin settings — skipping");
      return jsonResp({ skipped: true, reason: "CAPI disabled" });
    }

    if (!capiSettings.access_token || !capiSettings.pixel_id) {
      console.warn(
        "[capi-purchase] pixel_id or access_token missing in admin settings",
      );
      return jsonResp({
        skipped: true,
        reason: "Missing pixel_id or access_token",
      });
    }

    // Resolve dataset ID (falls back to pixel ID if not set, which is the
    // common case for standard pixels)
    const pixelId: string =
      capiSettings.dataset_id || capiSettings.pixel_id;
    const accessToken: string = capiSettings.access_token;
    const apiVersion: string = capiSettings.api_version || "v20.0";
    const testEventCode: string | null = capiSettings.test_mode
      ? (capiSettings.test_event_code || "TEST12345")
      : null;

    // ------------------------------------------------------------------
    // 3.  Parse the Database Webhook payload
    //     Supabase sends: { type: "INSERT", table: "orders", record: {...} }
    // ------------------------------------------------------------------
    const body = await req.json();
    const order = body?.record;

    if (!order?.id) {
      console.warn("[capi-purchase] No order record in webhook payload");
      return jsonResp({ error: "No order record" }, 400);
    }

    // Only process INSERT events (new orders)
    if (body?.type && body.type !== "INSERT") {
      console.log(`[capi-purchase] Skipping event type: ${body.type}`);
      return jsonResp({ skipped: true });
    }

    // ------------------------------------------------------------------
    // 4.  Fetch full order details (webhook may not include related data)
    // ------------------------------------------------------------------
    const { data: fullOrder, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        total,
        currency,
        user_id,
        fbc,
        fbp,
        order_items (
          id,
          product_id,
          quantity,
          unit_price,
          sku,
          products ( name, sku )
        ),
        users ( email, full_name )
      `,
      )
      .eq("id", order.id)
      .single();

    if (orderError || !fullOrder) {
      console.error("[capi-purchase] Failed to fetch order:", orderError);
      // Return 200 so Supabase doesn't keep retrying
      return jsonResp({ error: "Order not found", detail: orderError });
    }

    // ------------------------------------------------------------------
    // 5.  Hash PII (SHA-256 as required by Meta CAPI)
    // ------------------------------------------------------------------
    const userEmail: string = fullOrder.users?.email ?? "";
    const fullName: string = fullOrder.users?.full_name ?? "";
    const nameParts = fullName.trim().split(/\s+/);

    const hashedEmail = userEmail ? await sha256(userEmail) : undefined;
    const hashedFn = nameParts[0] ? await sha256(nameParts[0]) : undefined;
    const hashedLn =
      nameParts.length > 1
        ? await sha256(nameParts.slice(1).join(" "))
        : undefined;
    const hashedExternalId = fullOrder.user_id
      ? await sha256(fullOrder.user_id)
      : undefined;

    // IP + User-Agent forwarded from the original browser request via Supabase
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // ------------------------------------------------------------------
    // 6.  Build line-item data
    // ------------------------------------------------------------------
    type OrderItem = {
      product_id: string;
      sku?: string;
      quantity: number;
      unit_price?: string | number;
      products?: { sku?: string };
    };
    const items: OrderItem[] = (fullOrder.order_items as OrderItem[]) ?? [];
    const contentIds = items.map(
      (i) => i.sku ?? i.products?.sku ?? i.product_id,
    );
    const contents = items.map((i) => ({
      id: i.sku ?? i.products?.sku ?? i.product_id,
      quantity: i.quantity,
      item_price: parseFloat(String(i.unit_price ?? 0)),
    }));
    const totalValue = parseFloat(String(fullOrder.total ?? 0));

    // ------------------------------------------------------------------
    // 7.  Build the CAPI payload
    //     event_id = Order UUID — MUST match the browser Pixel eventID
    // ------------------------------------------------------------------
    const capiPayload: Record<string, unknown> = {
      data: [
        {
          event_name: "Purchase",
          /**
           * ⚠️  DEDUPLICATION KEY
           * This value MUST be identical to the `eventID` option passed on the
           * checkout page:
           *   fbq('track', 'Purchase', { ... }, { eventID: orderId })
           * When both share the same event_id, Meta counts ONE purchase.
           */
          event_id: fullOrder.id,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: {
            ...(hashedEmail && { em: [hashedEmail] }),
            ...(hashedFn && { fn: [hashedFn] }),
            ...(hashedLn && { ln: [hashedLn] }),
            ...(hashedExternalId && { external_id: [hashedExternalId] }),
            ...(clientIp && { client_ip_address: clientIp }),
            ...(userAgent && { client_user_agent: userAgent }),
            // fbc/fbp stored on the order by the checkout page at purchase time
            ...(fullOrder.fbc && { fbc: fullOrder.fbc }),
            ...(fullOrder.fbp && { fbp: fullOrder.fbp }),
          },
          custom_data: {
            value: totalValue,
            currency: fullOrder.currency ?? "BDT",
            content_ids: contentIds,
            content_type: "product",
            contents,
            num_items: items.length,
            order_id: fullOrder.id,
          },
        },
      ],
      // Include test_event_code only when test_mode is on in the admin panel
      ...(testEventCode && { test_event_code: testEventCode }),
    };

    // ------------------------------------------------------------------
    // 8.  Send to Meta Conversions API
    // ------------------------------------------------------------------
    const capiUrl = `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${accessToken}`;

    console.log("[capi-purchase] Sending CAPI event for order:", fullOrder.id, {
      pixel_id: pixelId,
      api_version: apiVersion,
      test_mode: capiSettings.test_mode,
    });

    const capiResponse = await fetch(capiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capiPayload),
    });

    const capiResult = await capiResponse.json();

    if (!capiResponse.ok) {
      console.error("[capi-purchase] CAPI error:", capiResult);
      // Return 200 so Supabase doesn't retry; log the error instead
      return jsonResp({ error: "CAPI request failed", detail: capiResult });
    }

    console.log("[capi-purchase] Success:", {
      order_id: fullOrder.id,
      events_received: capiResult.events_received,
      fbtrace_id: capiResult.fbtrace_id,
    });

    return jsonResp({
      success: true,
      order_id: fullOrder.id,
      events_received: capiResult.events_received,
      fbtrace_id: capiResult.fbtrace_id,
    });
  } catch (err) {
    console.error("[capi-purchase] Unhandled error:", err);
    return jsonResp({ error: "Internal error", detail: String(err) }, 500);
  }
});
