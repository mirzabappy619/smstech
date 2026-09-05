import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSION_CODES } from "./permissions";
import { SYSTEM_ROLES } from "./roles";
import { errorResponse } from "@/lib/api-utils";
import {
	getCachedUserRBAC,
	setCachedUserRBAC,
} from "./rbac-cache";

export interface BranchInfo {
	id: string;
	name: string;
	code: string;
	address: string | null;
	isActive: boolean;
	isDefault: boolean;
}

export interface UserBranchContext {
	isAllBranches: boolean;
	defaultBranchId: string | null;
	branches: BranchInfo[];
	branchIds: string[];
}

export interface ResolvedUserRBAC {
	userId: string;
	authId: string;
	email: string;
	fullName: string;
	role: string;
	roleName: string;
	isOwner: boolean;
	isAdmin: boolean;
	permissions: string[];
	branchContext: UserBranchContext;
}

/**
 * Resolves full permissions and branch access for a user.
 */
export async function getUserPermissionsAndBranches(
	authId: string,
): Promise<ResolvedUserRBAC | null> {
	// Resolving this is five queries. It is the same five on every request a
	// signed-in user makes, so a short TTL turns a whole burst of them — a
	// cashier typing into the POS search — into one. See ./rbac-cache.
	const cached = getCachedUserRBAC(authId);
	if (cached) return cached;

	try {
		const adminSupabase = await createAdminClient();

		// 1. Fetch user record
		const { data: userProfile, error: userError } = await adminSupabase
			.from("users")
			.select("*")
			.or(`auth_id.eq.${authId},id.eq.${authId}`)
			.maybeSingle();

		if (userError || !userProfile) {
			return null;
		}

		const roleKey = userProfile.role || "customer";
		const isOwner = roleKey === "owner";
		const isAllBranches = isOwner || !!userProfile.is_all_branches;
		const defaultBranchId = userProfile.default_branch_id || null;

		// 2. Fetch all active warehouses / branches
		const { data: allWarehouses } = await adminSupabase
			.from("warehouses")
			.select("id, name, code, address, is_active, is_default")
			.eq("is_active", true)
			.order("name", { ascending: true });

		const activeBranches: BranchInfo[] = (allWarehouses || []).map((w: any) => ({
			id: w.id,
			name: w.name,
			code: w.code,
			address: w.address,
			isActive: w.is_active,
			isDefault: w.is_default,
		}));

		// 3. Resolve Branch Assignments
		let assignedBranches: BranchInfo[] = [];
		if (isAllBranches) {
			assignedBranches = activeBranches;
		} else {
			// Check user_branches junction table if available
			const { data: userBranchLinks } = await adminSupabase
				.from("user_branches")
				.select("warehouse_id, is_default")
				.eq("user_id", userProfile.id);

			if (userBranchLinks && userBranchLinks.length > 0) {
				const linkedIds = new Set(userBranchLinks.map((ub: any) => ub.warehouse_id));
				assignedBranches = activeBranches.filter((b) => linkedIds.has(b.id));
			} else if (defaultBranchId) {
				assignedBranches = activeBranches.filter((b) => b.id === defaultBranchId);
			}

			// If no explicit branch link found, fallback to the first default branch
			if (assignedBranches.length === 0 && activeBranches.length > 0) {
				const def = activeBranches.find((b) => b.isDefault) || activeBranches[0];
				assignedBranches = [def];
			}
		}

		// 4. Resolve Permissions
		let rolePermissions: string[] = [];

		// Try loading from dynamic DB tables first
		try {
			const { data: dbRolePerms } = await adminSupabase
				.from("role_permissions")
				.select("permission_code")
				.eq("role_key", roleKey);

			if (dbRolePerms && dbRolePerms.length > 0) {
				rolePermissions = dbRolePerms.map((rp: any) => rp.permission_code);
			}
		} catch {
			// Ignore if DB table not yet created
		}

		// Fallback to in-memory system role permissions
		if (rolePermissions.length === 0) {
			if (isOwner) {
				rolePermissions = ALL_PERMISSION_CODES;
			} else {
				rolePermissions = DEFAULT_ROLE_PERMISSIONS[roleKey] || [];
			}
		}

		// Merge user-specific custom permission overrides
		const customOverrides: string[] = Array.isArray(userProfile.custom_permissions)
			? userProfile.custom_permissions
			: [];

		const finalPermissions = Array.from(
			new Set([...rolePermissions, ...customOverrides]),
		);

		const roleMeta = SYSTEM_ROLES[roleKey];

		const resolved: ResolvedUserRBAC = {
			userId: userProfile.id,
			authId: userProfile.auth_id || authId,
			email: userProfile.email,
			fullName: userProfile.full_name || userProfile.email,
			role: roleKey,
			roleName: roleMeta ? roleMeta.name : roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
			isOwner,
			isAdmin: isOwner || roleKey === "admin",
			permissions: isOwner ? ALL_PERMISSION_CODES : finalPermissions,
			branchContext: {
				isAllBranches,
				defaultBranchId: defaultBranchId || (assignedBranches[0]?.id ?? null),
				branches: assignedBranches,
				branchIds: assignedBranches.map((b) => b.id),
			},
		};

		setCachedUserRBAC(authId, resolved);
		return resolved;
	} catch (err) {
		console.error("[RBAC Service] Error resolving user RBAC:", err);
		return null;
	}
}

/**
 * Checks if a permission code exists in the user's permission set.
 */
export function hasPermission(
	userPermissions: string[],
	requiredPermission: string,
): boolean {
	if (!userPermissions || userPermissions.length === 0) return false;
	if (userPermissions.includes("*")) return true;
	return userPermissions.includes(requiredPermission);
}

/**
 * Checks if user has access to a specific branch ID.
 */
export function hasBranchAccess(
	branchContext: UserBranchContext,
	targetBranchId: string,
): boolean {
	if (!branchContext) return false;
	if (branchContext.isAllBranches) return true;
	return branchContext.branchIds.includes(targetBranchId);
}

/**
 * Middleware/Route helper to authenticate and resolve RBAC context.
 */
export async function getAuthUserWithRBAC(
	_request?: NextRequest,
): Promise<ResolvedUserRBAC | null> {
	try {
		const supabase = await createServerClient();
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error || !user) return null;

		return await getUserPermissionsAndBranches(user.id);
	} catch {
		return null;
	}
}

/**
 * Route Guard requiring a specific permission.
 */
export async function requirePermission(
	request: NextRequest,
	permissionCode: string,
): Promise<
	| { userRBAC: ResolvedUserRBAC; error?: never }
	| { userRBAC?: never; error: NextResponse }
> {
	const userRBAC = await getAuthUserWithRBAC(request);

	if (!userRBAC) {
		return {
			error: errorResponse("UNAUTHENTICATED", "Authentication required", 401),
		};
	}

	if (!hasPermission(userRBAC.permissions, permissionCode)) {
		return {
			error: errorResponse(
				"FORBIDDEN",
				`Access denied: Missing permission '${permissionCode}'`,
				403,
			),
		};
	}

	return { userRBAC };
}

/**
 * Route Guard requiring access to a specific branch.
 */
export async function requireBranchAccess(
	request: NextRequest,
	branchId: string,
): Promise<
	| { userRBAC: ResolvedUserRBAC; error?: never }
	| { userRBAC?: never; error: NextResponse }
> {
	const userRBAC = await getAuthUserWithRBAC(request);

	if (!userRBAC) {
		return {
			error: errorResponse("UNAUTHENTICATED", "Authentication required", 401),
		};
	}

	if (!hasBranchAccess(userRBAC.branchContext, branchId)) {
		return {
			error: errorResponse(
				"FORBIDDEN",
				"Access denied: You do not have permissions for this branch",
				403,
			),
		};
	}

	return { userRBAC };
}
