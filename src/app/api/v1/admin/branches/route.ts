import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, validationErrorResponse } from "@/lib/api-utils";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { z } from "zod";

const branchSchema = z.object({
	name: z.string().min(2).max(100),
	code: z.string().min(2).max(20).toUpperCase(),
	address: z.string().optional().nullable(),
	phone: z.string().optional().nullable(),
	is_active: z.boolean().default(true),
	is_default: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
	const authCheck = await requirePermission(request, "inventory:view");
	if (authCheck.error) {
		return authCheck.error;
	}

	const adminSupabase = await createAdminClient();

	const { data: branches, error } = await adminSupabase
		.from("warehouses")
		.select("*")
		.order("name", { ascending: true });

	if (error) {
		return errorResponse("DB_ERROR", error.message, 500);
	}

	return jsonResponse({
		branches: branches || [],
	});
}

export async function POST(request: NextRequest) {
	const authCheck = await requirePermission(request, "branches:manage");
	if (authCheck.error) {
		return authCheck.error;
	}

	try {
		const body = await request.json();
		const validation = branchSchema.safeParse(body);
		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { name, code, address, phone, is_active, is_default } = validation.data;
		const adminSupabase = await createAdminClient();

		// If is_default is true, uncheck others
		if (is_default) {
			await adminSupabase.from("warehouses").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
		}

		const { data: newBranch, error: insertError } = await adminSupabase
			.from("warehouses")
			.upsert({
				name,
				code,
				address: address || null,
				phone: phone || null,
				is_active,
				is_default,
				updated_at: new Date().toISOString(),
			}, { onConflict: "code" })
			.select()
			.single();

		if (insertError) {
			return errorResponse("DB_ERROR", insertError.message, 500);
		}

		return jsonResponse({
			branch: newBranch,
			message: "Branch saved successfully",
		}, 201);
	} catch (err: any) {
		return errorResponse("INTERNAL_ERROR", err.message || "Failed to save branch", 500);
	}
}
