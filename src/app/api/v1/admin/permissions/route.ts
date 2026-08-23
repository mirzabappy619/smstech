import { NextRequest } from "next/server";
import { PERMISSIONS, MODULE_ORDER, ALL_PERMISSION_CODES } from "@/lib/rbac/permissions";
import { jsonResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";

export async function GET(request: NextRequest) {
	const authCheck = await requirePermission(request, "roles:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	const grouped = MODULE_ORDER.map((module) => {
		const perms = Object.values(PERMISSIONS).filter((p) => p.module === module);
		return {
			module,
			permissions: perms,
		};
	});

	return jsonResponse({
		modules: grouped,
		allCodes: ALL_PERMISSION_CODES,
	});
}
