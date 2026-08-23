import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, validationErrorResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { z } from "zod";

const updateStaffSchema = z.object({
	full_name: z.string().min(2).optional(),
	phone: z.string().optional().nullable(),
	role: z.string().min(2).optional(),
	is_active: z.boolean().optional(),
	is_all_branches: z.boolean().optional(),
	default_branch_id: z.string().uuid().optional().nullable(),
	assigned_branch_ids: z.array(z.string().uuid()).optional(),
	password: z.string().min(6).optional(),
});

export async function PUT(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	const authCheck = await requirePermission(request, "staff:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	try {
		const body = await request.json();
		const validation = updateStaffSchema.safeParse(body);
		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const {
			full_name,
			phone,
			role,
			is_active,
			is_all_branches,
			default_branch_id,
			assigned_branch_ids,
			password,
		} = validation.data;

		const adminSupabase = await createAdminClient();

		// Find target user
		const { data: user, error: findError } = await adminSupabase
			.from("users")
			.select("id, auth_id, email, role")
			.or(`id.eq.${id},auth_id.eq.${id}`)
			.single();

		if (findError || !user) {
			return errorResponse("NOT_FOUND", "User not found", 404);
		}

		// Prevent deactivating own account
		if (authCheck.userRBAC?.userId === user.id && is_active === false) {
			return errorResponse("FORBIDDEN", "Cannot deactivate your own account", 400);
		}

		// 1. Update password in Supabase Auth if provided
		if (password && user.auth_id) {
			await adminSupabase.auth.admin.updateUserById(user.auth_id, {
				password,
			});
		}

		// 2. Update users table record
		const updates: any = {
			updated_at: new Date().toISOString(),
		};
		if (full_name !== undefined) updates.full_name = full_name;
		if (phone !== undefined) updates.phone = phone;
		if (role !== undefined) updates.role = role;
		if (is_active !== undefined) updates.is_active = is_active;
		if (is_all_branches !== undefined) updates.is_all_branches = is_all_branches;
		if (default_branch_id !== undefined) updates.default_branch_id = default_branch_id;

		const { data: updatedUser, error: updateError } = await adminSupabase
			.from("users")
			.update(updates)
			.eq("id", user.id)
			.select()
			.single();

		if (updateError) {
			return errorResponse("DB_ERROR", updateError.message, 500);
		}

		// 3. Update user_branches junction table if assigned_branch_ids was passed
		if (assigned_branch_ids !== undefined) {
			try {
				// Delete existing links
				await adminSupabase.from("user_branches").delete().eq("user_id", user.id);

				// Insert new links
				if (assigned_branch_ids.length > 0) {
					const rows = assigned_branch_ids.map((branchId) => ({
						user_id: user.id,
						warehouse_id: branchId,
						is_default: branchId === (default_branch_id || assigned_branch_ids[0]),
					}));
					await adminSupabase.from("user_branches").insert(rows);
				}
			} catch {
				// ignore if table not present
			}
		}

		return jsonResponse({
			user: updatedUser,
			message: "Staff user updated successfully",
		});
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to update staff user", 500);
	}
}

export async function DELETE(
	request: NextRequest,
	props: { params: Promise<{ id: string }> }
) {
	const { id } = await props.params;
	const authCheck = await requirePermission(request, "staff:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const adminSupabase = await createAdminClient();

	const { data: user, error: findError } = await adminSupabase
		.from("users")
		.select("id, auth_id, role")
		.or(`id.eq.${id},auth_id.eq.${id}`)
		.single();

	if (findError || !user) {
		return errorResponse("NOT_FOUND", "User not found", 404);
	}

	if (authCheck.userRBAC?.userId === user.id) {
		return errorResponse("FORBIDDEN", "Cannot delete your own account", 400);
	}

	// Deactivate user or delete
	await adminSupabase.from("users").update({ is_active: false }).eq("id", user.id);

	return jsonResponse({
		message: "User deactivated successfully",
	});
}
