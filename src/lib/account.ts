/**
 * Identity resolution for signed-in shoppers.
 *
 * Three different ids refer to the same person and they are easy to confuse:
 *
 *   auth.users.id   the Supabase auth id — what `supabase.auth.getUser()` returns
 *   users.id        the application profile row, keyed to auth by `users.auth_id`
 *   customers.id    the commerce record; `customers.user_id` points at users.id
 *
 * Rows owned by the shopper hang off different ones of these: wishlists and
 * addresses reference `users.id`, while orders reference `customers.id`. These
 * helpers do the hop so routes never match an auth id against the wrong column.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// The project mixes generated-typed and untyped Supabase clients; accepting the
// base client type keeps these helpers usable from both.
type AnyClient = SupabaseClient;

/** Maps a Supabase auth id to the `users.id` profile row id. */
export async function resolveProfileId(
	supabase: AnyClient,
	authId: string,
): Promise<string | null> {
	const { data } = await supabase
		.from("users")
		.select("id")
		.eq("auth_id", authId)
		.maybeSingle();
	return data?.id ?? null;
}

/**
 * Maps a `users.id` to every `customers.id` linked to it. A shopper normally
 * has one customer record, but in-store POS sales can create additional ones,
 * so this returns all of them for order lookups.
 */
export async function resolveCustomerIds(
	supabase: AnyClient,
	profileId: string,
): Promise<string[]> {
	const { data } = await supabase
		.from("customers")
		.select("id")
		.eq("user_id", profileId);
	return (data ?? []).map((row: { id: string }) => row.id);
}

export interface CustomerIdentity {
	profileId?: string | null;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
}

/**
 * Returns the customer row an order should hang off, creating one if needed.
 *
 * Signed-in shoppers are matched on `user_id` so repeat orders land on the same
 * record. Guests are matched on phone first (the reliable identifier in BD)
 * then email, so a returning guest is not duplicated on every checkout.
 */
export async function findOrCreateCustomer(
	supabase: AnyClient,
	identity: CustomerIdentity,
): Promise<{ id: string } | { error: string }> {
	const { profileId, name, email, phone } = identity;

	if (profileId) {
		const { data } = await supabase
			.from("customers")
			.select("id")
			.eq("user_id", profileId)
			.limit(1)
			.maybeSingle();
		if (data?.id) return { id: data.id };
	} else if (phone) {
		const { data } = await supabase
			.from("customers")
			.select("id")
			.eq("phone", phone)
			.limit(1)
			.maybeSingle();
		if (data?.id) return { id: data.id };
	} else if (email) {
		const { data } = await supabase
			.from("customers")
			.select("id")
			.eq("email", email)
			.limit(1)
			.maybeSingle();
		if (data?.id) return { id: data.id };
	}

	const { data: created, error } = await supabase
		.from("customers")
		.insert({
			user_id: profileId ?? null,
			name: name || email || phone || "Guest",
			email: email || null,
			phone: phone || null,
		})
		.select("id")
		.single();

	if (error || !created) {
		return { error: error?.message ?? "Failed to create customer record" };
	}
	return { id: created.id };
}
