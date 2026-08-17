import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/app/database.types";

export function createBrowserSupabaseClient() {
	return createBrowserClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	);
}

// Alias for easier imports
export const createClient = createBrowserSupabaseClient;
