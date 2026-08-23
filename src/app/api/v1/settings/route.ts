import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse } from "@/lib/api-utils";

interface StoreSettings {
	shipping_methods?: Array<{ id: string; name: string; description: string; price: number; is_active: boolean }>;
	shipping_enabled?: boolean;
	free_shipping_threshold?: number;
	default_shipping_cost?: number;
	store_name?: string;
	store_email?: string;
	store_phone?: string;
	store_address?: string;
	store_currency?: string;
	social_facebook?: string;
	social_instagram?: string;
	social_youtube?: string;
	social_whatsapp?: string;
	social_twitter?: string;
	homepage_settings?: Record<string, unknown>;
}

const DEFAULT_SETTINGS: StoreSettings = {
	store_name: "SMSTech BD",
	store_email: "info@smstech.bd",
	store_phone: "01781485588, 01723249598",
	store_address: "Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205",
	store_currency: "BDT",
	social_facebook: "https://facebook.com/smstech.bd",
	social_instagram: "https://instagram.com/smstech.bd",
	social_youtube: "https://youtube.com/@smstech",
	social_whatsapp: "https://wa.me/8801781485588",
	social_twitter: "https://twitter.com/smstechbd",
	shipping_methods: [
		{ id: "standard", name: "Inside Dhaka Delivery", description: "24–48 hours", price: 60, is_active: true },
		{ id: "outside", name: "Outside Dhaka Courier", description: "2–4 business days", price: 120, is_active: true },
		{ id: "pickup", name: "Store Pickup (Multiplan)", description: "Ready within hours", price: 0, is_active: true },
	],
};

/** GET /api/v1/settings — public, returns storefront-safe fields */
export async function GET(_request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const { data, error } = await supabase
			.from("store_settings")
			.select("*")
			.single();

		if (error || !data) {
			return jsonResponse(DEFAULT_SETTINGS);
		}

		return jsonResponse({
			...DEFAULT_SETTINGS,
			...data,
		});
	} catch {
		return jsonResponse(DEFAULT_SETTINGS);
	}
}
