import { createAdminClient } from "@/lib/supabase/server";

export interface StoreSettings {
	store_name: string;
	store_email: string;
	store_phone: string;
	store_address: string;
	social_facebook: string;
	social_instagram: string;
	social_twitter: string;
}

export async function getStoreSettings(): Promise<StoreSettings> {
	const defaults: StoreSettings = {
		store_name: "SMS Tech BD",
		store_email: "info@smstech.bd",
		store_phone: "01781485588",
		store_address: "",
		social_facebook: "",
		social_instagram: "",
		social_twitter: "",
	};
	try {
		const supabase = await createAdminClient();
		const { data } = await supabase
			.from("store_settings")
			.select("store_name, store_email, store_phone, store_address, social_facebook, social_instagram, social_twitter")
			.single();
		if (!data) return defaults;

		let storeName = (data.store_name || "").trim();
		if (!storeName || storeName.toLowerCase().includes("gizmo")) {
			storeName = "SMS Tech BD";
		}

		return {
			store_name: storeName,
			store_email: data.store_email || defaults.store_email,
			store_phone: data.store_phone || defaults.store_phone,
			store_address: data.store_address || defaults.store_address,
			social_facebook: data.social_facebook || defaults.social_facebook,
			social_instagram: data.social_instagram || defaults.social_instagram,
			social_twitter: data.social_twitter || defaults.social_twitter,
		};
	} catch {
		return defaults;
	}
}

export async function getStoreName(): Promise<string> {
	const settings = await getStoreSettings();
	return settings.store_name;
}
