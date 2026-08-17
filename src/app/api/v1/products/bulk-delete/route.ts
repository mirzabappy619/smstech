import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse, withAuth } from "@/lib/api-utils";

export async function DELETE(request: NextRequest) {
	return withAuth(request, async (req, user) => {
		if (user.role !== "admin" && user.role !== "owner")
			return errorResponse("FORBIDDEN", "Forbidden", 403);

		try {
			const body = await req.json();
			const { ids } = body as { ids: string[] };

			if (!ids || !Array.isArray(ids) || ids.length === 0) {
				return errorResponse(
					"INVALID_REQUEST",
					"ids must be a non-empty array of product IDs",
					400,
				);
			}

			const supabase = await createServerClient();

			const { error, count } = await supabase
				.from("products")
				.delete({ count: "exact" })
				.in("id", ids);

			if (error) {
				return errorResponse(
					"BULK_DELETE_FAILED",
					"Failed to delete products",
					500,
				);
			}

			return jsonResponse({ deleted: count ?? ids.length });
		} catch {
			return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
		}
	});
}
