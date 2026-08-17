import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
	requireAdmin,
} from "@/lib/api-utils";
import {
	updateLandingPageSchema,
	updateBlocksSchema,
	validateBlockData,
} from "@/app/landing-page-types";

// GET /api/v1/admin/landing-pages/[id]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Fetch landing page with blocks
		const { data: landingPage, error: pageError } = await supabase
			.from("landing_pages")
			.select("*")
			.eq("id", id)
			.single();

		if (pageError || !landingPage) {
			return errorResponse("NOT_FOUND", "Landing page not found", 404);
		}

		// Fetch blocks
		const { data: blocks, error: blocksError } = await supabase
			.from("landing_page_blocks")
			.select("*")
			.eq("landing_page_id", id)
			.order("sort_order", { ascending: true });

		if (blocksError) {
			console.error("Error fetching blocks:", blocksError);
			return errorResponse("FETCH_FAILED", "Failed to fetch blocks", 500);
		}

		return successResponse({
			id: landingPage.id,
			title: landingPage.title,
			slug: landingPage.slug,
			metaTitle: landingPage.meta_title,
			metaDescription: landingPage.meta_description,
			metaKeywords: landingPage.meta_keywords,
			status: landingPage.status,
			blocks: (blocks || []).map((block: any) => ({
				id: block.id,
				blockType: block.block_type,
				blockData: block.block_data,
				sortOrder: block.sort_order,
				isActive: block.is_active,
			})),
		});
	} catch (error) {
		console.error("Get landing page error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// PUT /api/v1/admin/landing-pages/[id]
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { user, error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Get user info from database
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (!userData) {
			return errorResponse("USER_NOT_FOUND", "User not found", 404);
		}

		// Parse and validate request body
		const body = await request.json();

		// Handle blocks update separately if provided
		if (body.blocks) {
			const blocksValidation = updateBlocksSchema.safeParse({
				blocks: body.blocks,
			});
			if (!blocksValidation.success) {
				return validationErrorResponse(blocksValidation.error);
			}

			// Validate each block's data
			for (const block of blocksValidation.data.blocks) {
				const validation = validateBlockData(block.blockType, block.blockData);
				if (!validation.success) {
					return errorResponse(
						"INVALID_BLOCK_DATA",
						`Invalid ${block.blockType} block data: ${validation.error}`,
						400,
					);
				}
			}

			// Delete existing blocks and insert new ones
			await supabase
				.from("landing_page_blocks")
				.delete()
				.eq("landing_page_id", id);

			const blocksToInsert = blocksValidation.data.blocks.map((block) => ({
				landing_page_id: id,
				block_type: block.blockType,
				block_data: block.blockData,
				sort_order: block.sortOrder,
				is_active: block.isActive,
			}));

			if (blocksToInsert.length > 0) {
				const { error: blocksError } = await supabase
					.from("landing_page_blocks")
					.insert(blocksToInsert);

				if (blocksError) {
					console.error("Error updating blocks:", blocksError);
					return errorResponse("UPDATE_FAILED", "Failed to update blocks", 500);
				}
			}

			delete body.blocks;
		}

		// Update page metadata if provided
		if (Object.keys(body).length > 0) {
			const validation = updateLandingPageSchema.safeParse(body);
			if (!validation.success) {
				return validationErrorResponse(validation.error);
			}

			const { title, slug, metaTitle, metaDescription, metaKeywords } =
				validation.data;

			// Check slug uniqueness if changing
			if (slug) {
				const { data: existing } = await supabase
					.from("landing_pages")
					.select("id")
					.eq("slug", slug)
					.neq("id", id)
					.single();

				if (existing) {
					return errorResponse(
						"SLUG_EXISTS",
						"A landing page with this slug already exists",
						400,
					);
				}
			}

			const updateData: Record<string, unknown> = {
				updated_by: userData.id,
			};
			if (title !== undefined) updateData.title = title;
			if (slug !== undefined) updateData.slug = slug;
			if (metaTitle !== undefined) updateData.meta_title = metaTitle;
			if (metaDescription !== undefined)
				updateData.meta_description = metaDescription;
			if (metaKeywords !== undefined) updateData.meta_keywords = metaKeywords;

			const { error: updateError } = await supabase
				.from("landing_pages")
				.update(updateData)
				.eq("id", id);

			if (updateError) {
				console.error("Error updating landing page:", updateError);
				return errorResponse(
					"UPDATE_FAILED",
					"Failed to update landing page",
					500,
				);
			}
		}

		// Fetch updated page with blocks
		const { data: updatedPage } = await supabase
			.from("landing_pages")
			.select("*")
			.eq("id", id)
			.single();

		const { data: blocks } = await supabase
			.from("landing_page_blocks")
			.select("*")
			.eq("landing_page_id", id)
			.order("sort_order", { ascending: true });

		return successResponse({
			...updatedPage,
			blocks: blocks || [],
		});
	} catch (error) {
		console.error("Update landing page error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// DELETE /api/v1/admin/landing-pages/[id]
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Delete landing page (blocks will cascade delete)
		const { error } = await supabase
			.from("landing_pages")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting landing page:", error);
			return errorResponse(
				"DELETE_FAILED",
				"Failed to delete landing page",
				500,
			);
		}

		return successResponse({ success: true, message: "Landing page deleted" });
	} catch (error) {
		console.error("Delete landing page error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
