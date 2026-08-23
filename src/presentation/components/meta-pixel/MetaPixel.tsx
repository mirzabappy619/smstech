/**
 * Meta Pixel Client Script
 * Loads and initializes Meta Pixel for client-side tracking with CAPI deduplication.
 *
 * Deduplication rules:
 *  - Every event (Purchase, PageView, ViewContent, AddToCart, InitiateCheckout)
 *    shares the identical event_id between the browser Pixel (eventID parameter)
 *    and the server-side Conversions API (CAPI event_id payload).
 *  - CAPI relay runs even when browser fbq is blocked by adblockers to ensure
 *    reliable server-side tracking.
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

/**
 * Generate a unique event ID for Meta Pixel + CAPI deduplication.
 */
export function generateMetaEventId(prefix = "evt"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get cookie by name safely in the browser.
 */
export function getMetaCookie(name: string): string | undefined {
	if (typeof document === "undefined") return undefined;
	const match = document.cookie
		.split(";")
		.find((c) => c.trim().startsWith(name + "="));
	return match ? match.split("=").slice(1).join("=") : undefined;
}

export function MetaPixel({ pixelId, enabled, enabledEvents, externalId }: MetaPixelProps) {
	const initialized = useRef(false);

	function handleScriptLoad() {
		if (!enabled || !pixelId || initialized.current) return;
		initialized.current = true;

		// Pass external_id to improve match quality for all pixel events
		window.fbq("init", pixelId, externalId ? { external_id: externalId } : {});

		if (enabledEvents.includes("PageView")) {
			const pageViewEventId = generateMetaEventId("pv");
			window.fbq("track", "PageView", {}, { eventID: pageViewEventId });
		}
	}

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
 */
export function trackMetaEvent(
	eventName: string,
	parameters?: Record<string, any>,
	eventId = generateMetaEventId("evt"),
) {
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", eventName, parameters, { eventID: eventId });
	}
	relayCapi(eventName, parameters || {}, eventId);
}

/**
 * Track custom conversions
 */
export function trackMetaCustomEvent(
	eventName: string,
	parameters?: Record<string, any>,
	eventId = generateMetaEventId("cust"),
) {
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("trackCustom", eventName, parameters, { eventID: eventId });
	}
	relayCapi(eventName, parameters || {}, eventId);
}

/**
 * Relay a browser-fired pixel event to the server-side CAPI.
 * Reads _fbc/_fbp cookies and forwards them along with custom data.
 * Fire-and-forget — never blocks the caller.
 */
export function relayCapi(
	eventName: string,
	customData: Record<string, any>,
	eventId?: string,
	externalId?: string,
) {
	try {
		if (typeof window === "undefined") return;

		const fbc =
			getMetaCookie("_fbc") ||
			(() => {
				try {
					return sessionStorage.getItem("_fbc") || undefined;
				} catch {
					return undefined;
				}
			})();
		const fbp = getMetaCookie("_fbp");

		const payload: Record<string, any> = {
			event_name: eventName,
			event_source_url: window.location.href,
			fbc,
			fbp,
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

/**
 * Track a Purchase event with deduplication support.
 *
 * Pass the Order UUID as `eventId` — this MUST match the `event_id` sent
 * by the server-side Conversions API (CAPI) for the same order so Meta can
 * deduplicate the two signals into one conversion.
 */
export function trackMetaPurchase({
	eventId,
	value,
	currency = "BDT",
	contentIds = [],
	contents = [],
	numItems,
	externalId,
}: {
	eventId: string;
	value: number;
	currency?: string;
	contentIds?: string[];
	contents?: Array<{ id: string; quantity: number; item_price?: number }>;
	numItems?: number;
	externalId?: string;
}) {
	const customData: Record<string, any> = {
		value,
		currency,
		content_type: "product",
		order_id: eventId,
	};

	if (contentIds.length > 0) customData.content_ids = contentIds;
	if (contents.length > 0) customData.contents = contents;
	if (numItems !== undefined) customData.num_items = numItems;
	if (externalId) customData.external_id = externalId;

	// 1. Browser Pixel with eventID option
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", "Purchase", customData, { eventID: eventId });
	}

	// 2. Server CAPI relay with matching event_id
	relayCapi("Purchase", customData, eventId, externalId);
}

// ─── ViewContent ─────────────────────────────────────────────────────────────

/**
 * Track ViewContent for a product page.
 * Fires browser pixel + server-side CAPI relay with synchronized event_id.
 */
export function trackMetaViewContent({
	productId,
	productName,
	price,
	currency = "BDT",
	externalId,
	eventId = generateMetaEventId("vc"),
}: {
	productId: string;
	productName: string;
	price: number;
	currency?: string;
	externalId?: string;
	eventId?: string;
}) {
	const customData: Record<string, any> = {
		content_ids: [productId],
		content_type: "product",
		content_name: productName,
		contents: [{ id: productId, quantity: 1, item_price: price }],
		currency,
		value: price,
	};
	if (externalId) customData.external_id = externalId;

	// 1. Browser Pixel
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", "ViewContent", customData, { eventID: eventId });
	}

	// 2. CAPI relay
	relayCapi("ViewContent", customData, eventId, externalId);
}

// ─── AddToCart ───────────────────────────────────────────────────────────────

/**
 * Track AddToCart for a product.
 * Fires browser pixel + server-side CAPI relay with synchronized event_id.
 */
export function trackMetaAddToCart({
	productId,
	productName,
	price,
	quantity = 1,
	currency = "BDT",
	externalId,
	eventId = generateMetaEventId("atc"),
}: {
	productId: string;
	productName: string;
	price: number;
	quantity?: number;
	currency?: string;
	externalId?: string;
	eventId?: string;
}) {
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

	// 1. Browser Pixel
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", "AddToCart", customData, { eventID: eventId });
	}

	// 2. CAPI relay
	relayCapi("AddToCart", customData, eventId, externalId);
}

// ─── InitiateCheckout ────────────────────────────────────────────────────────

/**
 * Track InitiateCheckout when the user lands on the checkout page.
 * Fires browser pixel + server-side CAPI relay with synchronized event_id.
 */
export function trackMetaInitiateCheckout({
	contentIds,
	contents,
	numItems,
	value,
	currency = "BDT",
	externalId,
	eventId = generateMetaEventId("ic"),
}: {
	contentIds: string[];
	contents: Array<{ id: string; quantity: number; item_price?: number }>;
	numItems: number;
	value: number;
	currency?: string;
	externalId?: string;
	eventId?: string;
}) {
	const customData: Record<string, any> = {
		content_ids: contentIds,
		content_type: "product",
		contents,
		num_items: numItems,
		currency,
		value,
	};
	if (externalId) customData.external_id = externalId;

	// 1. Browser Pixel
	if (typeof window !== "undefined" && window.fbq) {
		window.fbq("track", "InitiateCheckout", customData, { eventID: eventId });
	}

	// 2. CAPI relay
	relayCapi("InitiateCheckout", customData, eventId, externalId);
}
