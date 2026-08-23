import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, validationErrorResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { SYSTEM_ROLES } from "@/lib/rbac/roles";
import { z } from "zod";

const createStaffSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	full_name: z.string().min(2),
	phone: z.string().optional().nullable(),
	role: z.string().min(2),
	is_all_branches: z.boolean().default(false),
	default_branch_id: z.string().uuid().optional().nullable(),
	assigned_branch_ids: z.array(z.string().uuid()).default([]),
});

export async function GET(request: NextRequest) {
	const authCheck = await requirePermission(request, "staff:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const adminSupabase = await createAdminClient();

	// 1. Fetch all users who are not standard storefront customers (or include all staff)
	const { data: users, error: usersError } = await adminSupabase
		.from("users")
		.select("id, auth_id, email, full_name, phone, role, is_active, is_all_branches, default_branch_id, created_at, updated_at")
		.order("created_at", { ascending: false });

	if (usersError) {
		return errorResponse("DB_ERROR", usersError.message, 500);
	}

	// 2. Fetch all warehouses/branches
	const { data: warehouses } = await adminSupabase
		.from("warehouses")
		.select("id, name, code, is_active");

	const warehouseMap = new Map((warehouses || []).map((w: any) => [w.id, w]));

	// 3. Fetch user_branches links
	let userBranchLinks: any[] = [];
	try {
		const { data } = await adminSupabase
			.from("user_branches")
			.select("user_id, warehouse_id, is_default");
		if (data) userBranchLinks = data;
	} catch {
		// ignore
	}

	const userBranchMap = new Map<string, string[]>();
	userBranchLinks.forEach((link) => {
		if (!userBranchMap.has(link.user_id)) {
			userBranchMap.set(link.user_id, []);
		}
		userBranchMap.get(link.user_id)!.push(link.warehouse_id);
	});

	// Format staff users
	const staffList = (users || []).map((u: any) => {
		const roleMeta = SYSTEM_ROLES[u.role] || {
			name: u.role,
			badgeColor: "bg-amber-100 text-amber-800",
		};

		const assignedIds = userBranchMap.get(u.id) || (u.default_branch_id ? [u.default_branch_id] : []);
		const assignedBranches = u.is_all_branches || u.role === "owner"
			? (warehouses || []).map((w: any) => ({ id: w.id, name: w.name, code: w.code }))
			: assignedIds
					.map((id) => warehouseMap.get(id))
					.filter(Boolean)
					.map((w: any) => ({ id: w.id, name: w.name, code: w.code }));

		const defaultBranch = u.default_branch_id ? warehouseMap.get(u.default_branch_id) : null;

		return {
			id: u.id,
			auth_id: u.auth_id,
			email: u.email,
			full_name: u.full_name || u.email,
			phone: u.phone,
			role: u.role,
			role_name: roleMeta.name,
			role_badge: roleMeta.badgeColor,
			is_active: u.is_active !== false,
			is_all_branches: u.role === "owner" || !!u.is_all_branches,
			default_branch: defaultBranch ? { id: defaultBranch.id, name: defaultBranch.name, code: defaultBranch.code } : null,
			assigned_branches: assignedBranches,
			assigned_branch_ids: u.is_all_branches ? (warehouses || []).map((w: any) => w.id) : assignedIds,
			created_at: u.created_at,
		};
	});

	return jsonResponse({
		staff: staffList,
		branches: warehouses || [],
	});
}

export async function POST(request: NextRequest) {
	const authCheck = await requirePermission(request, "staff:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	try {
		const body = await request.json();
		const validation = createStaffSchema.safeParse(body);
		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const {
			email,
			password,
			full_name,
			phone,
			role,
			is_all_branches,
			default_branch_id,
			assigned_branch_ids,
		} = validation.data;

		const adminSupabase = await createAdminClient();

		// 1. Create auth user in Supabase Auth
		const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: {
				full_name,
				role,
			},
		});

		if (authError || !authData.user) {
			return errorResponse("AUTH_CREATE_FAILED", authError?.message || "Failed to create auth user", 400);
		}

		// 2. Create public.users record
		const { data: newUser, error: userError } = await adminSupabase
			.from("users")
			.upsert({
				auth_id: authData.user.id,
				email,
				full_name,
				phone: phone || null,
				role,
				is_active: true,
				is_all_branches: role === "owner" || is_all_branches,
				default_branch_id: default_branch_id || (assigned_branch_ids[0] ?? null),
				updated_at: new Date().toISOString(),
			}, { onConflict: "auth_id" })
			.select()
			.single();

		if (userError) {
			return errorResponse("DB_ERROR", userError.message, 500);
		}

		// 3. Link assigned branches in user_branches table
		if (assigned_branch_ids && assigned_branch_ids.length > 0 && newUser) {
			try {
				const branchRows = assigned_branch_ids.map((branchId) => ({
					user_id: newUser.id,
					warehouse_id: branchId,
					is_default: branchId === default_branch_id,
				}));

				await adminSupabase.from("user_branches").insert(branchRows);
			} catch {
				// table might not exist yet
			}
		}

		return jsonResponse({
			user: newUser,
			message: "Staff user created successfully",
		}, 201);
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to create staff account", 500);
	}
}
