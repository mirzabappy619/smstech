import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse } from "@/lib/api-utils";
import { readStoreSettings, toPublicSettings } from "@/lib/store-settings";

/** GET /api/v1/settings — public, returns storefront-safe fields */
export async function GET(_request: NextRequest) {
	const supabase = await createServerClient();
	const settings = await readStoreSettings(supabase);
	return jsonResponse(toPublicSettings(settings));
}
