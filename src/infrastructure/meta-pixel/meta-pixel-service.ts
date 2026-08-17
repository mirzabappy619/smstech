/**
 * Meta Pixel Service
 * Handles server-side and client-side Meta Pixel event tracking
 */

import { createAdminClient } from "@/lib/supabase/server";
import { logger } from "@/infrastructure/logging/logger";

export type MetaEventType =
	| "PageView"
	| "ViewContent"
	| "AddToCart"
	| "InitiateCheckout"
	| "Purchase"
	| "AddPaymentInfo"
	| "Lead"
	| "CompleteRegistration"
	| "Search";

export interface MetaPixelSettings {
	id: string;
	pixel_id: string;
	access_token: string | null;
	dataset_id: string | null;
	api_version: string | null;
	test_event_code: string | null;
	enabled: boolean;
	fire_purchase_on_confirmed: boolean;
	enabled_events: MetaEventType[];
	test_mode: boolean;
	created_at: string;
	updated_at: string;
}

export interface MetaEventData {
	event_name: MetaEventType;
	/**
	 * Unique event identifier used for deduplication between browser Pixel and
	 * server-side CAPI. Both must send the same event_id for the same conversion.
	 * Use the Order UUID so it's naturally unique and shared across both signals.
	 */
	event_id?: string;
	event_time: number;
	event_source_url?: string;
	user_data?: {
		em?: string; // email (hashed SHA-256)
		ph?: string; // phone (hashed SHA-256)
		fn?: string; // first name (hashed SHA-256)
		ln?: string; // last name (hashed SHA-256)
		ct?: string; // city (hashed SHA-256)
		st?: string; // state (hashed SHA-256)
		zp?: string; // zip code (hashed SHA-256)
		country?: string; // country code (e.g. "BD")
		external_id?: string; // internal user ID (hashed SHA-256)
		/** Visitor's IP — used for Match Quality scoring */
		client_ip_address?: string;
		/** Visitor's User-Agent — used for Match Quality scoring */
		client_user_agent?: string;
		fbc?: string; // Facebook click ID (_fbc cookie)
		fbp?: string; // Facebook browser ID (_fbp cookie)
	};
	custom_data?: {
		value?: number;
		currency?: string;
		content_ids?: string[];
		content_type?: string;
		content_name?: string;
		content_category?: string;
		contents?: Array<{
			id: string;
			quantity: number;
			item_price?: number;
		}>;
		num_items?: number;
		order_id?: string;
		search_string?: string;
	};
	action_source?:
		| "website"
		| "email"
		| "app"
		| "phone_call"
		| "chat"
		| "physical_store"
		| "system_generated"
		| "other";
}

export class MetaPixelService {
	private static async getSettings(): Promise<MetaPixelSettings | null> {
		try {
			const supabase = await createAdminClient();
			const { data, error } = await supabase
				.from("meta_pixel_settings")
				.select("*")
				.eq("enabled", true)
				.single();

			if (error) {
				logger.error("Failed to fetch Meta Pixel settings", { error });
				return null;
			}

			return data as MetaPixelSettings;
		} catch (error) {
			logger.error("Error in getSettings", { error });
			return null;
		}
	}

	/**
	 * Check if a specific event type is enabled
	 */
	static async isEventEnabled(eventType: MetaEventType): Promise<boolean> {
		const settings = await this.getSettings();
		if (!settings || !settings.enabled) {
			return false;
		}
		return settings.enabled_events.includes(eventType);
	}

	/**
	 * Fire a server-side event using the Conversions API
	 */
	static async fireServerEvent(eventData: MetaEventData): Promise<boolean> {
		try {
			const settings = await this.getSettings();

			if (!settings || !settings.enabled) {
				logger.info("Meta Pixel is disabled");
				return false;
			}

			if (!settings.enabled_events.includes(eventData.event_name)) {
				logger.info(`Event ${eventData.event_name} is not enabled`);
				return false;
			}

			if (!settings.access_token) {
				logger.warn(
					"Meta Pixel access token not configured for server-side events",
				);
				return false;
			}

			// Prepare the event payload
			const payload = {
				data: [
					{
						event_name: eventData.event_name,
						// event_id enables deduplication: Meta will deduplicate
						// server CAPI + browser Pixel events that share the same
						// event_id.  Use the Order UUID so it's stable and unique.
						event_id: eventData.event_id,
						event_time: eventData.event_time,
						event_source_url: eventData.event_source_url,
						user_data: eventData.user_data,
						custom_data: eventData.custom_data,
						action_source: eventData.action_source || "website",
					},
				],
				test_event_code: settings.test_mode
					? (settings.test_event_code || "TEST12345")
					: undefined,
			};

			// Use dataset_id if set, otherwise fall back to pixel_id
			const datasetId = settings.dataset_id || settings.pixel_id;
			const apiVersion = settings.api_version || "v18.0";

			// Send to Meta Conversions API
			const response = await fetch(
				`https://graph.facebook.com/${apiVersion}/${datasetId}/events`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						...payload,
						access_token: settings.access_token,
					}),
				},
			);

			if (!response.ok) {
				const errorData = await response.json();
				logger.error("Meta Pixel API error", { errorData });
				return false;
			}

			const result = await response.json();
			logger.info("Meta Pixel event sent", {
				event: eventData.event_name,
				result,
				test_mode: settings.test_mode,
			});

			return true;
		} catch (error) {
			logger.error("Error firing Meta Pixel server event", {
				error,
				eventData,
			});
			return false;
		}
	}

	/**
	 * Fire a purchase event when an order is placed / confirmed.
	 *
	 * @param orderId   - The Order UUID. Used as the CAPI `event_id` so Meta can
	 *                    deduplicate against the matching browser Pixel event that
	 *                    was sent with the same `eventID` option.
	 * @param ignoreSetting - When true, bypasses the `fire_purchase_on_confirmed`
	 *                        flag and always fires. Pass `true` at order creation.
	 * @param clientIp  - Visitor's IP from the HTTP request (improves Match Quality).
	 * @param userAgent - Visitor's User-Agent string (improves Match Quality).
	 */
	static async firePurchaseEvent(
		orderId: string,
		ignoreSetting = false,
		clientIp?: string,
		userAgent?: string,
	): Promise<boolean> {
		try {
			const settings = await this.getSettings();

			if (!settings || !settings.enabled) {
				return false;
			}

			// If ignoreSetting is false, respect the fire_purchase_on_confirmed flag
			if (!ignoreSetting && !settings.fire_purchase_on_confirmed) {
				return false;
			}

			// Fetch order details
			const supabase = await createAdminClient();
			const { data: order, error: orderError } = await supabase
				.from("orders")
				.select(
					`
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            sku,
            products (
              name,
              sku
            )
          ),
          users (
            email,
            full_name
          )
        `,
				)
				.eq("id", orderId)
				.single();

			if (orderError || !order) {
				logger.error("Failed to fetch order for Meta Pixel event", {
					orderError,
				});
				return false;
			}

			// Hash user PII for CAPI match quality
			const hashedEmail = order.users?.email
				? await this.hashData(order.users.email)
				: undefined;
			const nameParts = (order.users?.full_name || "").trim().split(/\s+/);
			const hashedFn = nameParts[0]
				? await this.hashData(nameParts[0])
				: undefined;
			const hashedLn =
				nameParts.length > 1
					? await this.hashData(nameParts.slice(1).join(" "))
					: undefined;
			const hashedExternalId = order.user_id
				? await this.hashData(order.user_id)
				: undefined;

			// Build event data
			const totalValue = parseFloat(order.total ?? order.total_amount ?? "0");
			const eventData: MetaEventData = {
				event_name: "Purchase",
				// Use the Order UUID as the event_id — the browser Pixel must send
				// the identical value via fbq('track','Purchase',data,{eventID: orderId})
				event_id: orderId,
				event_time: Math.floor(Date.now() / 1000),
				action_source: "website",
				user_data: {
					em: hashedEmail,
					fn: hashedFn,
					ln: hashedLn,
					external_id: hashedExternalId,
					// IP and User-Agent improve Match Quality without additional
					// PII being stored — Meta uses them only for matching.
					client_ip_address: clientIp,
					client_user_agent: userAgent,
				},
				custom_data: {
					value: totalValue,
					currency: order.currency || "BDT",
					content_ids:
						order.order_items?.map(
							(item: any) => item.sku || item.products?.sku || item.product_id,
						) || [],
					content_type: "product",
					contents:
						order.order_items?.map((item: any) => ({
							id: item.sku || item.products?.sku || item.product_id,
							quantity: item.quantity,
							item_price: parseFloat(item.unit_price ?? item.price ?? "0"),
						})) || [],
					num_items: order.order_items?.length || 0,
					order_id: order.id,
				},
			};

			return await this.fireServerEvent(eventData);
		} catch (error) {
			logger.error("Error firing purchase event", { error, orderId });
			return false;
		}
	}

	/**
	 * Hash data for user data (SHA-256)
	 */
	private static async hashData(data: string): Promise<string> {
		const normalized = data.toLowerCase().trim();
		const encoder = new TextEncoder();
		const dataBuffer = encoder.encode(normalized);
		const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		return hashHex;
	}

	/**
	 * Get the current pixel settings (for client-side rendering)
	 */
	static async getClientSettings(): Promise<{
		pixelId: string;
		enabled: boolean;
		enabledEvents: MetaEventType[];
		testMode: boolean;
	} | null> {
		const settings = await this.getSettings();
		if (!settings) {
			return null;
		}

		return {
			pixelId: settings.pixel_id,
			enabled: settings.enabled,
			enabledEvents: settings.enabled_events,
			testMode: settings.test_mode,
		};
	}
}
