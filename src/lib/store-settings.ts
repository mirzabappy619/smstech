/**
 * Store settings accessor.
 *
 * `store_settings` is a key/value table (key TEXT UNIQUE, value JSONB), but the
 * admin settings screen, the storefront and the PDF generators all work with a
 * single flat settings object. Every read and write goes through here so the
 * two shapes cannot drift apart again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShippingMethod {
	id: string;
	name: string;
	description?: string;
	price: number;
	is_active: boolean;
}

export interface StoreSettings {
	store_name: string;
	store_email: string;
	store_phone: string;
	store_address: string;
	store_currency: string;
	store_timezone: string;
	tax_rate: number;
	shipping_enabled: boolean;
	free_shipping_threshold: number;
	default_shipping_cost: number;
	inventory_tracking: boolean;
	low_stock_threshold: number;
	allow_guest_checkout: boolean;
	order_prefix: string;
	notify_on_order: boolean;
	notify_on_low_stock: boolean;
	social_facebook: string;
	social_instagram: string;
	social_twitter: string;
	social_youtube: string;
	social_whatsapp: string;
	maintenance_mode: boolean;
	shipping_methods: ShippingMethod[];
	homepage_settings: Record<string, unknown>;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
	store_name: "SMS Tech BD",
	store_email: "info@smstech.bd",
	store_phone: "01781485588, 01723249598",
	store_address:
		"Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205",
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
	social_twitter: "https://twitter.com/smstechbd",
	social_youtube: "https://youtube.com/@smstech",
	social_whatsapp: "https://wa.me/8801781485588",
	maintenance_mode: false,
	shipping_methods: [
		{
			id: "standard",
			name: "Inside Dhaka Delivery",
			description: "24–48 hours",
			price: 60,
			is_active: true,
		},
		{
			id: "outside",
			name: "Outside Dhaka Courier",
			description: "2–4 business days",
			price: 120,
			is_active: true,
		},
		{
			id: "pickup",
			name: "Store Pickup (Multiplan)",
			description: "Ready within hours",
			price: 0,
			is_active: true,
		},
	],
	homepage_settings: {},
};

/** Fields safe to expose on the public storefront endpoint. */
export const PUBLIC_SETTING_KEYS = [
	"store_name",
	"store_email",
	"store_phone",
	"store_address",
	"store_currency",
	"shipping_enabled",
	"free_shipping_threshold",
	"default_shipping_cost",
	"shipping_methods",
	"social_facebook",
	"social_instagram",
	"social_twitter",
	"social_youtube",
	"social_whatsapp",
	"maintenance_mode",
	"homepage_settings",
] as const satisfies readonly (keyof StoreSettings)[];

// The project mixes generated-typed and untyped Supabase clients; accepting the
// base client type keeps these helpers usable from both.
type AnyClient = SupabaseClient;

/**
 * Reads every settings row and folds it over the defaults. Unknown keys in the
 * table are preserved so a setting added by a migration is not dropped here.
 */
export async function readStoreSettings(
	supabase: AnyClient,
): Promise<StoreSettings & Record<string, unknown>> {
	try {
		const { data, error } = await supabase
			.from("store_settings")
			.select("key, value");

		if (error || !data) return { ...DEFAULT_STORE_SETTINGS };

		const stored: Record<string, unknown> = {};
		for (const row of data as Array<{ key: string; value: unknown }>) {
			if (row?.key == null) continue;
			// A NULL/undefined value means "not configured" — fall back rather
			// than overwriting a usable default with null.
			if (row.value === null || row.value === undefined) continue;
			stored[row.key] = row.value;
		}

		return { ...DEFAULT_STORE_SETTINGS, ...stored };
	} catch {
		return { ...DEFAULT_STORE_SETTINGS };
	}
}

/**
 * Upserts one row per changed key. Returns the full settings object as it
 * stands after the write.
 */
export async function writeStoreSettings(
	supabase: AnyClient,
	patch: Record<string, unknown>,
): Promise<{ settings: StoreSettings & Record<string, unknown>; error?: string }> {
	const entries = Object.entries(patch).filter(([, v]) => v !== undefined);

	if (entries.length > 0) {
		const rows = entries.map(([key, value]) => ({
			key,
			value,
			updated_at: new Date().toISOString(),
		}));

		const { error } = await supabase
			.from("store_settings")
			.upsert(rows, { onConflict: "key" });

		if (error) {
			return { settings: await readStoreSettings(supabase), error: error.message };
		}
	}

	return { settings: await readStoreSettings(supabase) };
}

/** Subset of settings the storefront is allowed to see. */
export function toPublicSettings(
	settings: StoreSettings & Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of PUBLIC_SETTING_KEYS) out[key] = settings[key];
	return out;
}
