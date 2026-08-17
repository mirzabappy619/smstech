/**
 * Meta Pixel Client Script
 * Loads and initializes Meta Pixel for client-side tracking.
 *
 * Deduplication note:
 *  - Purchase events must be sent with { eventID: orderId } to match the
 *    server-side CAPI event_id so Meta deduplicates them into one conversion.
 *  - PageView events should also include an eventID when possible (generated
 *    once per page load) to help Meta match the CAPI PageView signal.
 */

"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface MetaPixelProps {
	pixelId: string;
	enabled: boolean;
	enabledEvents: string[];
	externalId?: string;
}

declare global {
	interface Window {
		fbq?: any;
		_fbq?: any;
	}
}

export function MetaPixel({ pixelId, enabled, enabledEvents, externalId }: MetaPixelProps) {
	// Track whether we've already initialized to prevent double-init when
	// React re-renders (e.g. in Strict Mode or after hydration).
	const initialized = useRef(false);

	// Called by Next.js Script onLoad — fbevents.js is ready at this point.
	function handleScriptLoad() {
		if (!enabled || !pixelId || initialized.current) return;
		initialized.current = true;

		// Pass external_id to improve match quality for all pixel events
		window.fbq("init", pixelId, externalId ? { external_id: externalId } : {});

		if (enabledEvents.includes("PageView")) {
			// Generate a stable per-pageload event ID so the optional server-side
			// PageView CAPI signal can use the same ID for deduplication.
			const pageViewEventId = `pv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			window.fbq("track", "PageView", {}, { eventID: pageViewEventId });
		}
	}

	// If the script was already loaded before this component mounted (e.g.
	// navigating between pages in a SPA), fbq will already exist — initialize
	// directly from the effect rather than waiting for onLoad.
	useEffect(() => {
		if (!enabled || !pixelId || initialized.current) return;
		if (typeof window !== "undefined" && window.fbq) {
			handleScriptLoad();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pixelId, enabled]);

	if (!enabled || !pixelId) return null;

	return (
		<>
			<Script
				id="meta-pixel"
				strategy="afterInteractive"
				onLoad={handleScriptLoad}
				dangerouslySetInnerHTML={{
					__html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          `,
				}}
			/>
			<noscript>
				<img
					height="1"
					width="1"
					style={{ display: "none" }}
					src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
					alt=""
				/>
			</noscript>
		</>
	);
}


/**
 * Track a standard Meta Pixel event.
 * @param eventName - Standard event name (e.g. "ViewContent", "AddToCart")
 * @param parameters - Event-specific parameters
 */
export function trackMetaEvent(
	eventName: string,
	parameters?: Record<string, any>,
) {
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", eventName, parameters);
	}
}

/**
 * Track custom conversions
 */
export function trackMetaCustomEvent(
	eventName: string,
	parameters?: Record<string, any>,
) {
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("trackCustom", eventName, parameters);
	}
}

/**
 * Track a Purchase event with deduplication support.
 *
 * Pass the Order's UUID as `eventId` — this MUST match the `event_id` sent
 * by the server-side Conversions API (CAPI) for the same order so Meta can
 * deduplicate the two signals and count the purchase only once.
 *
 * Also accepts an optional `externalId` (user's internal ID) to improve
 * match quality when the Pixel and CAPI share the same `external_id`.
 *
 * @example
 * trackMetaPurchase({
 *   eventId: order.id,          // Order UUID — shared with CAPI
 *   value: 1250,
 *   currency: "BDT",
 *   contentIds: ["sku-1", "sku-2"],
 *   numItems: 2,
 *   externalId: user?.id,       // optional — hashed server-side in CAPI
 * });
 */
export function trackMetaPurchase({
	eventId,
	value,
	currency = "BDT",
	contentIds = [],
	numItems,
	externalId,
}: {
	eventId: string;
	value: number;
	currency?: string;
	contentIds?: string[];
	numItems?: number;
	externalId?: string;
}) {
	if (typeof window === "undefined" || !window.fbq) return;

	const parameters: Record<string, any> = {
		value,
		currency,
		content_type: "product",
	};

	if (contentIds.length > 0) parameters.content_ids = contentIds;
	if (numItems !== undefined) parameters.num_items = numItems;

	// The eventID option (note: camelCase) is what Meta uses for deduplication.
	// It must be identical to the event_id sent to the Conversions API.
	const eventOptions: Record<string, string> = { eventID: eventId };

	// Attach external_id if available for better match quality
	if (externalId) {
		parameters.external_id = externalId;
	}

	window.fbq("track", "Purchase", parameters, eventOptions);
}

// ─── Cookie helpers ─────────────────────────────────────────────────────────

function getCookie(name: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	return document.cookie
		.split(";")
		.find((c) => c.trim().startsWith(name + "="))
		?.split("=")[1];
}

/**
 * Relay a browser-fired pixel event to the server-side CAPI.
 * Reads _fbc/_fbp cookies and forwards them along with custom data.
 * Fire-and-forget — never blocks the caller.
 */
function relayCapi(
	eventName: string,
	customData: Record<string, any>,
	eventId?: string,
	externalId?: string,
) {
	try {
		const payload: Record<string, any> = {
			event_name: eventName,
			event_source_url: window.location.href,
			fbc: getCookie("_fbc"),
			fbp: getCookie("_fbp"),
			custom_data: customData,
		};
		if (eventId) payload.event_id = eventId;
		if (externalId) payload.external_id = externalId;

		fetch("/api/v1/meta-pixel/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(payload),
		}).catch(() => {});
	} catch {
		// Never throw — tracking must not break the user flow
	}
}

// ─── ViewContent ─────────────────────────────────────────────────────────────

/**
 * Track ViewContent for a product page.
 * Fires browser pixel + server-side CAPI relay.
 */
export function trackMetaViewContent({
	productId,
	productName,
	price,
	currency = "BDT",
	externalId,
}: {
	productId: string;
	productName: string;
	price: number;
	currency?: string;
	externalId?: string;
}) {
	if (typeof window === "undefined" || !window.fbq) return;

	const customData: Record<string, any> = {
		content_ids: [productId],
		content_type: "product",
		content_name: productName,
		contents: [{ id: productId, quantity: 1, item_price: price }],
		currency,
		value: price,
	};
	if (externalId) customData.external_id = externalId;

	window.fbq("track", "ViewContent", customData);
	relayCapi(
		"ViewContent",
		{
			content_ids: [productId],
			content_type: "product",
			content_name: productName,
			contents: [{ id: productId, quantity: 1, item_price: price }],
			currency,
			value: price,
		},
		undefined,
		externalId,
	);
}

// ─── AddToCart ───────────────────────────────────────────────────────────────

/**
 * Track AddToCart for a product.
 * Fires browser pixel + server-side CAPI relay.
 */
export function trackMetaAddToCart({
	productId,
	productName,
	price,
	quantity,
	currency = "BDT",
	externalId,
}: {
	productId: string;
	productName: string;
	price: number;
	quantity: number;
	currency?: string;
	externalId?: string;
}) {
	if (typeof window === "undefined" || !window.fbq) return;

	const value = price * quantity;
	const customData: Record<string, any> = {
		content_ids: [productId],
		content_type: "product",
		content_name: productName,
		contents: [{ id: productId, quantity, item_price: price }],
		currency,
		value,
	};
	if (externalId) customData.external_id = externalId;

	window.fbq("track", "AddToCart", customData);
	relayCapi(
		"AddToCart",
		{
			content_ids: [productId],
			content_type: "product",
			content_name: productName,
			contents: [{ id: productId, quantity, item_price: price }],
			currency,
			value,
		},
		undefined,
		externalId,
	);
}

// ─── InitiateCheckout ────────────────────────────────────────────────────────

/**
 * Track InitiateCheckout when the user lands on the checkout page.
 * Fires browser pixel + server-side CAPI relay.
 */
export function trackMetaInitiateCheckout({
	contentIds,
	contents,
	numItems,
	value,
	currency = "BDT",
	externalId,
}: {
	contentIds: string[];
	contents: Array<{ id: string; quantity: number; item_price?: number }>;
	numItems: number;
	value: number;
	currency?: string;
	externalId?: string;
}) {
	if (typeof window === "undefined" || !window.fbq) return;

	const customData: Record<string, any> = {
		content_ids: contentIds,
		content_type: "product",
		contents,
		num_items: numItems,
		currency,
		value,
	};
	if (externalId) customData.external_id = externalId;

	window.fbq("track", "InitiateCheckout", customData);
	relayCapi(
		"InitiateCheckout",
		{
			content_ids: contentIds,
			content_type: "product",
			contents,
			num_items: numItems,
			currency,
			value,
		},
		undefined,
		externalId,
	);
}
