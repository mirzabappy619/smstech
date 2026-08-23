import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, validationErrorResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { SYSTEM_ROLES } from "@/lib/rbac/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/rbac/permissions";
import { z } from "zod";

const createRoleSchema = z.object({
	key: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, and underscores only"),
	name: z.string().min(2).max(100),
	description: z.string().max(300).optional(),
	permissions: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const adminSupabase = await createAdminClient();

	// 1. Fetch DB roles if table exists
	let dbRoles: any[] = [];
	try {
		const { data, error } = await adminSupabase
			.from("roles")
			.select("*")
			.order("is_system", { ascending: false });

		if (!error && data) {
			dbRoles = data;
		}
	} catch {
		// table may not exist yet
	}

	// 2. Fetch role_permissions from DB
	let dbRolePerms: Record<string, string[]> = {};
	try {
		const { data } = await adminSupabase
			.from("role_permissions")
			.select("role_key, permission_code");

		if (data) {
			data.forEach((item: any) => {
				if (!dbRolePerms[item.role_key]) dbRolePerms[item.role_key] = [];
				dbRolePerms[item.role_key].push(item.permission_code);
			});
		}
	} catch {
		// ignore
	}

	// 3. Count users per role
	let userCounts: Record<string, number> = {};
	try {
		const { data } = await adminSupabase.from("users").select("role");
		if (data) {
			data.forEach((u: any) => {
				const r = u.role || "customer";
				userCounts[r] = (userCounts[r] || 0) + 1;
			});
		}
	} catch {
		// ignore
	}

	// 4. Combine system roles and DB roles
	const combinedRoles: any[] = [];
	const seenKeys = new Set<string>();

	// Add system roles first
	Object.values(SYSTEM_ROLES).forEach((sysRole) => {
		seenKeys.add(sysRole.key);
		const permissions = dbRolePerms[sysRole.key] || DEFAULT_ROLE_PERMISSIONS[sysRole.key] || [];
		combinedRoles.push({
			id: sysRole.key,
			key: sysRole.key,
			name: sysRole.name,
			description: sysRole.description,
			is_system: true,
			badge_color: sysRole.badgeColor,
			level: sysRole.level,
			permissions,
			user_count: userCounts[sysRole.key] || 0,
		});
	});

	// Add any custom DB roles
	dbRoles.forEach((dbRole) => {
		if (!seenKeys.has(dbRole.key)) {
			seenKeys.add(dbRole.key);
			combinedRoles.push({
				id: dbRole.id || dbRole.key,
				key: dbRole.key,
				name: dbRole.name,
				description: dbRole.description,
				is_system: !!dbRole.is_system,
				badge_color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
				level: 30,
				permissions: dbRolePerms[dbRole.key] || [],
				user_count: userCounts[dbRole.key] || 0,
			});
		}
	});

	return jsonResponse({
		roles: combinedRoles,
	});
}

export async function POST(request: NextRequest) {
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	try {
		const body = await request.json();
		const validation = createRoleSchema.safeParse(body);
		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { key, name, description, permissions } = validation.data;

		if (SYSTEM_ROLES[key]) {
			return errorResponse("ROLE_EXISTS", `Cannot create role with reserved system key '${key}'`, 400);
		}

		const adminSupabase = await createAdminClient();

		// Insert role into roles table
		const { data: newRole, error: roleError } = await adminSupabase
			.from("roles")
			.insert({
				key,
				name,
				description: description || null,
				is_system: false,
			})
			.select()
			.single();

		if (roleError) {
			return errorResponse("DB_ERROR", roleError.message, 500);
		}

		// Insert permissions
		if (permissions && permissions.length > 0) {
			const permRows = permissions.map((code) => ({
				role_key: key,
				permission_code: code,
			}));

			await adminSupabase.from("role_permissions").insert(permRows);
		}

		return jsonResponse({
			role: {
				...newRole,
				permissions,
			},
			message: "Role created successfully",
		}, 201);
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to create role", 500);
	}
}
