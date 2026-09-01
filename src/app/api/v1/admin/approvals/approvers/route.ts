import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { SYSTEM_ROLES } from "@/lib/rbac/roles";

/**
 * GET /api/v1/admin/approvals/approvers
 *
 * Everything the pipeline builder needs to populate its pickers: the roles a
 * step can be assigned to, the staff who can be named individually, and the
 * branches a pipeline can be scoped to.
 *
 * Gated on approvals:manage rather than staff:manage so configuring a chain
 * does not require the right to edit staff accounts.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:manage");
		if (auth.error) return auth.error;

		const supabase = await createAdminClient();

		const [{ data: users }, { data: warehouses }] = await Promise.all([
			supabase
				.from("users")
				.select("id, full_name, email, role, is_active")
				.neq("role", "customer")
				.order("full_name", { ascending: true }),
			supabase
				.from("warehouses")
				.select("id, name, code")
				.eq("is_active", true)
				.order("name", { ascending: true }),
		]);

		// Customers never approve anything; everyone else is a legal step owner.
		const roles = Object.values(SYSTEM_ROLES)
			.filter((r) => r.key !== "customer")
			.sort((a, b) => b.level - a.level)
			.map((r) => ({ key: r.key, name: r.name, level: r.level }));

		return NextResponse.json({
			success: true,
			data: {
				roles,
				users: (users || []).filter(
					(u: { is_active?: boolean }) => u.is_active !== false,
				),
				warehouses: warehouses || [],
			},
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}
