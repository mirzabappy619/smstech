/**
 * Short-lived cache for resolved RBAC.
 *
 * Every guarded admin request called getUserPermissionsAndBranches, and that
 * function is five round trips: the user row, the warehouse list, the branch
 * assignments, the role's permissions, then the merge. None of it changes
 * between one keystroke and the next, but the POS was paying for all of it on
 * every search request — before the endpoint ran a single query of its own.
 *
 * The cache is per process and deliberately short-lived. A permission or
 * branch change therefore takes effect within {@link RBAC_CACHE_TTL_MS} rather
 * than instantly; the screens that make those changes call
 * {@link invalidateUserRBAC} so the common case is immediate anyway.
 *
 * Not a substitute for the auth check: the caller still verifies the session
 * with Supabase on every request, and only the resolution of *what that user
 * may do* is cached.
 */

import type { ResolvedUserRBAC } from "./rbac-service";

/** Long enough to cover a burst of requests, short enough that a revoked
 *  permission cannot outlive a cashier noticing. */
export const RBAC_CACHE_TTL_MS = 30_000;

/** Guards against a process that has seen a very large number of users. */
const MAX_ENTRIES = 500;

interface Entry {
	value: ResolvedUserRBAC;
	expiresAt: number;
}

const cache = new Map<string, Entry>();

export function getCachedUserRBAC(authId: string): ResolvedUserRBAC | null {
	const entry = cache.get(authId);
	if (!entry) return null;

	if (entry.expiresAt <= Date.now()) {
		cache.delete(authId);
		return null;
	}

	return entry.value;
}

export function setCachedUserRBAC(authId: string, value: ResolvedUserRBAC): void {
	// Oldest-first eviction. Map preserves insertion order, and every write
	// re-inserts, so the first key is the least recently written.
	if (cache.size >= MAX_ENTRIES) {
		const oldest = cache.keys().next();
		if (!oldest.done) cache.delete(oldest.value);
	}

	cache.delete(authId);
	cache.set(authId, { value, expiresAt: Date.now() + RBAC_CACHE_TTL_MS });
}

/**
 * Drop a user's cached permissions, or everyone's when called with no id —
 * which is what a change to a role's permission set needs, since it moves
 * every user holding that role.
 */
export function invalidateUserRBAC(authId?: string): void {
	if (authId) {
		cache.delete(authId);
		// The resolver is keyed by whichever id the caller had, and both the
		// auth id and the user row id reach it.
		for (const [key, entry] of cache) {
			if (entry.value.userId === authId || entry.value.authId === authId) {
				cache.delete(key);
			}
		}
		return;
	}

	cache.clear();
}

/** Exposed for tests. */
export function rbacCacheSize(): number {
	return cache.size;
}
