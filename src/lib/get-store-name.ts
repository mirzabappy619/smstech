import { createAdminClient } from "@/lib/supabase/server";
import {
	DEFAULT_STORE_SETTINGS,
	readStoreSettings,
} from "@/lib/store-settings";

export interface StoreSettings {
	store_name: string;
	store_email: string;
	store_phone: string;
	store_address: string;
	store_currency: string;
	social_facebook: string;
	social_instagram: string;
	social_twitter: string;
}

export async function getStoreSettings(): Promise<StoreSettings> {
	const defaults: StoreSettings = {
		store_name: DEFAULT_STORE_SETTINGS.store_name,
		store_email: DEFAULT_STORE_SETTINGS.store_email,
		store_phone: DEFAULT_STORE_SETTINGS.store_phone,
		store_address: DEFAULT_STORE_SETTINGS.store_address,
		store_currency: DEFAULT_STORE_SETTINGS.store_currency,
		social_facebook: DEFAULT_STORE_SETTINGS.social_facebook,
		social_instagram: DEFAULT_STORE_SETTINGS.social_instagram,
		social_twitter: DEFAULT_STORE_SETTINGS.social_twitter,
	};

	try {
		const supabase = await createAdminClient();
		const settings = await readStoreSettings(supabase);

		// Guard against the placeholder name left over from the old branding.
		let storeName = (settings.store_name || "").trim();
		if (!storeName || storeName.toLowerCase().includes("gizmo")) {
			storeName = defaults.store_name;
		}

		return {
			store_name: storeName,
			store_email: settings.store_email || defaults.store_email,
			store_phone: settings.store_phone || defaults.store_phone,
			store_address: settings.store_address || defaults.store_address,
			store_currency: settings.store_currency || defaults.store_currency,
			social_facebook: settings.social_facebook || defaults.social_facebook,
			social_instagram: settings.social_instagram || defaults.social_instagram,
			social_twitter: settings.social_twitter || defaults.social_twitter,
		};
	} catch {
		return defaults;
	}
}

export async function getStoreName(): Promise<string> {
	const settings = await getStoreSettings();
	return settings.store_name;
}
