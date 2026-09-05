/**
 * The RBAC cache sits in front of five queries that ran on every guarded
 * request. These pin the parts that would be a security problem if they broke:
 * entries must expire, and a permission change must be able to drop them.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
	RBAC_CACHE_TTL_MS,
	getCachedUserRBAC,
	setCachedUserRBAC,
	invalidateUserRBAC,
	rbacCacheSize,
} from "@/lib/rbac/rbac-cache";
import type { ResolvedUserRBAC } from "@/lib/rbac/rbac-service";

function rbac(overrides: Partial<ResolvedUserRBAC> = {}): ResolvedUserRBAC {
	return {
		userId: "user-1",
		authId: "auth-1",
		email: "cashier@example.com",
		fullName: "Cashier",
		role: "cashier",
		roleName: "Cashier",
		isOwner: false,
		isAdmin: false,
		permissions: ["pos:access"],
		branchContext: {
			isAllBranches: false,
			defaultBranchId: "branch-1",
			branches: [],
			branchIds: ["branch-1"],
		},
		...overrides,
	};
}

beforeEach(() => {
	invalidateUserRBAC();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("rbac cache", () => {
	it("returns what was stored", () => {
		setCachedUserRBAC("auth-1", rbac());
		expect(getCachedUserRBAC("auth-1")?.permissions).toEqual(["pos:access"]);
	});

	it("misses for a user it has never seen", () => {
		expect(getCachedUserRBAC("nobody")).toBeNull();
	});

	it("expires an entry once the TTL has passed", () => {
		vi.useFakeTimers();
		setCachedUserRBAC("auth-1", rbac());

		vi.advanceTimersByTime(RBAC_CACHE_TTL_MS - 1);
		expect(getCachedUserRBAC("auth-1")).not.toBeNull();

		vi.advanceTimersByTime(2);
		expect(getCachedUserRBAC("auth-1")).toBeNull();
	});

	it("drops the expired entry rather than holding it", () => {
		vi.useFakeTimers();
		setCachedUserRBAC("auth-1", rbac());
		vi.advanceTimersByTime(RBAC_CACHE_TTL_MS + 1);

		getCachedUserRBAC("auth-1");
		expect(rbacCacheSize()).toBe(0);
	});

	it("invalidates one user by auth id", () => {
		setCachedUserRBAC("auth-1", rbac());
		setCachedUserRBAC("auth-2", rbac({ userId: "user-2", authId: "auth-2" }));

		invalidateUserRBAC("auth-1");

		expect(getCachedUserRBAC("auth-1")).toBeNull();
		expect(getCachedUserRBAC("auth-2")).not.toBeNull();
	});

	it("invalidates by the user row id too", () => {
		// Staff screens hold the users.id, not the auth id, and the cache is
		// keyed by whichever id reached the resolver.
		setCachedUserRBAC("auth-1", rbac({ userId: "user-1", authId: "auth-1" }));

		invalidateUserRBAC("user-1");

		expect(getCachedUserRBAC("auth-1")).toBeNull();
	});

	it("clears everyone when a role's permissions change", () => {
		setCachedUserRBAC("auth-1", rbac());
		setCachedUserRBAC("auth-2", rbac({ userId: "user-2", authId: "auth-2" }));

		invalidateUserRBAC();

		expect(rbacCacheSize()).toBe(0);
	});

	it("does not grow without bound", () => {
		for (let i = 0; i < 600; i++) {
			setCachedUserRBAC(`auth-${i}`, rbac({ userId: `user-${i}`, authId: `auth-${i}` }));
		}
		expect(rbacCacheSize()).toBeLessThanOrEqual(500);
		// The most recent writes are the ones worth keeping.
		expect(getCachedUserRBAC("auth-599")).not.toBeNull();
	});
});
