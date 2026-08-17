import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	notFoundResponse,
	requireAdmin,
	validateRequest,
} from "@/lib/api-utils";

const updateCategorySchema = z
	.object({
		name: z.string().trim().min(1).max(100).optional(),
		slug: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
			.optional(),
		description: z.string().max(5000).nullable().optional(),
		status: z.enum(["active", "inactive"]).optional(),
		parent_id: z.string().uuid().nullable().optional(),
		meta_title: z.string().max(70).nullable().optional(),
		meta_description: z.string().max(160).nullable().optional(),
		sort_order: z.number().int().min(0).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required",
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

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const validation = await validateRequest(request, updateCategorySchema);
		if (validation.error) return validation.error;

		const { id } = await params;
		const updates = validation.data;
		const supabase = await createAdminClient();

		const { data: existing, error: existingError } = await supabase
			.from("categories")
			.select("id, metadata")
			.eq("id", id)
			.single();

		if (existingError || !existing) {
			return notFoundResponse("Category");
		}

		const mergedMetadata = {
			...((existing.metadata as Record<string, unknown> | null) || {}),
		};

		if (Object.prototype.hasOwnProperty.call(updates, "meta_title")) {
			mergedMetadata.meta_title = updates.meta_title ?? null;
		}
		if (Object.prototype.hasOwnProperty.call(updates, "meta_description")) {
			mergedMetadata.meta_description = updates.meta_description ?? null;
		}

		const updatePayload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};

		if (updates.name !== undefined) updatePayload.name = updates.name;
		if (updates.slug !== undefined) updatePayload.slug = updates.slug;
		if (updates.description !== undefined)
			updatePayload.description = updates.description;
		if (updates.parent_id !== undefined) updatePayload.parent_id = updates.parent_id;
		if (updates.sort_order !== undefined) updatePayload.sort_order = updates.sort_order;
		if (updates.status !== undefined)
			updatePayload.is_active = updates.status === "active";
		if (
			Object.prototype.hasOwnProperty.call(updates, "meta_title") ||
			Object.prototype.hasOwnProperty.call(updates, "meta_description")
		) {
			updatePayload.metadata = mergedMetadata;
		}

		const { data: category, error } = await supabase
			.from("categories")
			.update(updatePayload)
			.eq("id", id)
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
				"CATEGORY_UPDATE_FAILED",
				"Failed to update category",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return jsonResponse(mapCategoryResponse(category));
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id } = await params;
		const supabase = await createAdminClient();

		const { data: deleted, error } = await supabase
			.from("categories")
			.delete()
			.eq("id", id)
			.select("id")
			.maybeSingle();

		if (error) {
			return errorResponse(
				"CATEGORY_DELETE_FAILED",
				"Failed to delete category",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		if (!deleted) {
			return notFoundResponse("Category");
		}

		return jsonResponse({ id, deleted: true });
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
