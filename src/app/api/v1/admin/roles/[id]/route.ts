import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, validationErrorResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { SYSTEM_ROLES } from "@/lib/rbac/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/rbac/permissions";
import { z } from "zod";
import { invalidateUserRBAC } from "@/lib/rbac/rbac-cache";

const updateRoleSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	description: z.string().max(300).optional(),
	permissions: z.array(z.string()).optional(),
});

export async function GET(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const roleKey = id;
	const adminSupabase = await createAdminClient();

	// Check DB or system
	let roleInfo: any = null;
	const sysRole = SYSTEM_ROLES[roleKey];

	const { data: dbRole } = await adminSupabase
		.from("roles")
		.select("*")
		.or(`key.eq.${roleKey},id.eq.${roleKey}`)
		.maybeSingle();

	if (dbRole) {
		roleInfo = dbRole;
	} else if (sysRole) {
		roleInfo = {
			key: sysRole.key,
			name: sysRole.name,
			description: sysRole.description,
			is_system: true,
		};
	}

	if (!roleInfo) {
		return errorResponse("NOT_FOUND", "Role not found", 404);
	}

	// Fetch permissions
	let permissions: string[] = [];
	const { data: dbPerms } = await adminSupabase
		.from("role_permissions")
		.select("permission_code")
		.eq("role_key", roleInfo.key);

	if (dbPerms && dbPerms.length > 0) {
		permissions = dbPerms.map((p: any) => p.permission_code);
	} else if (DEFAULT_ROLE_PERMISSIONS[roleInfo.key]) {
		permissions = DEFAULT_ROLE_PERMISSIONS[roleInfo.key];
	}

	return jsonResponse({
		role: {
			...roleInfo,
			permissions,
		},
	});
}

export async function PUT(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	try {
		const body = await request.json();
		const validation = updateRoleSchema.safeParse(body);
		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { name, description, permissions } = validation.data;
		const adminSupabase = await createAdminClient();
		const roleKey = id;

		// If it's a custom role, update details in roles table
		if (!SYSTEM_ROLES[roleKey]) {
			const updates: any = {};
			if (name) updates.name = name;
			if (description !== undefined) updates.description = description;

			if (Object.keys(updates).length > 0) {
				await adminSupabase
					.from("roles")
					.update(updates)
					.or(`key.eq.${roleKey},id.eq.${roleKey}`);
			}
		}

		// Update permissions in role_permissions table
		if (permissions) {
			// Delete existing
			await adminSupabase
				.from("role_permissions")
				.delete()
				.eq("role_key", roleKey);

			if (permissions.length > 0) {
				const rows = permissions.map((code) => ({
					role_key: roleKey,
					permission_code: code,
				}));
				await adminSupabase.from("role_permissions").insert(rows);
			}
		}

		// A role's permission set moves every user holding it, and the cache is
		// keyed by user — so this clears the lot rather than guessing who.
		invalidateUserRBAC();

		return jsonResponse({
			message: "Role updated successfully",
		});
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to update role", 500);
	}
}

export async function DELETE(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const roleKey = id;

	if (SYSTEM_ROLES[roleKey]) {
		return errorResponse("FORBIDDEN", "System roles cannot be deleted", 400);
	}

	const adminSupabase = await createAdminClient();

	// Check if any users currently have this role
	const { data: usersWithRole } = await adminSupabase
		.from("users")
		.select("id")
		.eq("role", roleKey)
		.limit(1);

	if (usersWithRole && usersWithRole.length > 0) {
		return errorResponse(
			"ROLE_IN_USE",
			"Cannot delete role because one or more users are currently assigned this role",
			400
		);
	}

	// Delete from role_permissions
	await adminSupabase.from("role_permissions").delete().eq("role_key", roleKey);

	// Delete from roles table
	const { error } = await adminSupabase
		.from("roles")
		.delete()
		.or(`key.eq.${roleKey},id.eq.${roleKey}`);

	if (error) {
		return errorResponse("DB_ERROR", error.message, 500);
	}

	invalidateUserRBAC();

	return jsonResponse({
		message: "Role deleted successfully",
	});
}
