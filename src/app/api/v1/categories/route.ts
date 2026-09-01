import { NextRequest } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	requireAdmin,
	validateRequest,
} from "@/lib/api-utils";
import { z } from "zod";

const createCategorySchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
	description: z.string().max(5000).nullable().optional(),
	status: z.enum(["active", "inactive"]).default("active"),
	parent_id: z.string().uuid().nullable().optional(),
	meta_title: z.string().max(70).nullable().optional(),
	meta_description: z.string().max(160).nullable().optional(),
	sort_order: z.number().int().min(0).optional(),
});

function mapCategoryResponse(category: Record<string, unknown>) {
	const metadata =
		typeof category.metadata === "object" && category.metadata !== null
			? (category.metadata as Record<string, unknown>)
			: {};

	return {
		...category,
		status: category.is_active ? "active" : "inactive",
		meta_title: (metadata.meta_title as string | null) ?? null,
		meta_description: (metadata.meta_description as string | null) ?? null,
	};
}

export async function GET(request: NextRequest) {
	try {
		const includeInactive =
			request.nextUrl.searchParams.get("include_inactive") === "true";

		if (includeInactive) {
			const { error: authError } = await requireAdmin(request);
			if (authError) return authError;
		}

		const supabase = await createServerClient();

		let query = supabase
			.from("categories")
			.select("*")
			.order("sort_order", { ascending: true });

		if (!includeInactive) {
			query = query.eq("is_active", true);
		}

		const { data: categories, error } = await query;

		if (error)
			return errorResponse(
				"CATEGORIES_FETCH_FAILED",
				"Failed to fetch categories",
				500,
			);

		// Product counts for every category in one pass. This ran a COUNT query
		// per category before, so the nav menu cost one round trip per row.
		const categoryIds = (categories || []).map((c) => c.id);
		const countByCategory = new Map<string, number>();

		if (categoryIds.length > 0) {
			const { data: activeProducts } = await supabase
				.from("products")
				.select("category_id")
				.eq("is_active", true)
				.in("category_id", categoryIds);

			for (const row of activeProducts || []) {
				const key = row.category_id as string;
				countByCategory.set(key, (countByCategory.get(key) ?? 0) + 1);
			}
		}

		const categoriesWithCounts = (categories || []).map((category) =>
			mapCategoryResponse({
				...category,
				product_count: countByCategory.get(category.id) ?? 0,
			}),
		);

		return jsonResponse(categoriesWithCounts);
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

export async function POST(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const validation = await validateRequest(request, createCategorySchema);
		if (validation.error) return validation.error;

		const payload = validation.data;
		const supabase = await createAdminClient();

		const { data: category, error } = await supabase
			.from("categories")
			.insert({
				name: payload.name,
				slug: payload.slug,
				description: payload.description ?? null,
				parent_id: payload.parent_id ?? null,
				sort_order: payload.sort_order ?? 0,
				is_active: payload.status === "active",
				metadata: {
					meta_title: payload.meta_title ?? null,
					meta_description: payload.meta_description ?? null,
				},
			})
			.select("*")
			.single();

		if (error) {
			if (error.code === "23505") {
				return errorResponse(
					"CATEGORY_SLUG_EXISTS",
					"A category with this slug already exists",
					HTTP_STATUS.CONFLICT,
				);
			}

			return errorResponse(
				"CATEGORY_CREATE_FAILED",
				"Failed to create category",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return jsonResponse(mapCategoryResponse(category), HTTP_STATUS.CREATED);
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
