import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/v1/landing/[slug]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
) {
	try {
		const { slug } = await params;
		const supabase = await createServerClient();

		// Check for preview mode (requires admin auth)
		const isPreview = request.nextUrl.searchParams.get("preview") === "true";

		if (isPreview) {
			// Try to get authenticated user from session
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				return errorResponse(
					"UNAUTHORIZED",
					"Unauthorized - Preview requires authentication",
					401,
				);
			}

			const { data: userData } = await supabase
				.from("users")
				.select("role")
				.eq("auth_id", user.id)
				.single();

			if (userData?.role !== "admin" && userData?.role !== "owner") {
				return errorResponse(
					"FORBIDDEN",
					"Forbidden - Preview requires admin access",
					403,
				);
			}

			// Fetch landing page (any status)
			const { data: landingPage, error: pageError } = await supabase
				.from("landing_pages")
				.select("*")
				.eq("slug", slug)
				.single();

			if (pageError || !landingPage) {
				return errorResponse("NOT_FOUND", "Landing page not found", 404);
			}

			// Fetch blocks
			const { data: blocks, error: blocksError } = await supabase
				.from("landing_page_blocks")
				.select("*")
				.eq("landing_page_id", landingPage.id)
				.eq("is_active", true)
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
		}

		// Public access - only published pages
		const { data: landingPage, error: pageError } = await supabase
			.from("landing_pages")
			.select("*")
			.eq("slug", slug)
			.eq("status", "published")
			.single();

		if (pageError || !landingPage) {
			return errorResponse("NOT_FOUND", "Landing page not found", 404);
		}

		// Fetch blocks
		const { data: blocks, error: blocksError } = await supabase
			.from("landing_page_blocks")
			.select("*")
			.eq("landing_page_id", landingPage.id)
			.eq("is_active", true)
			.order("sort_order", { ascending: true });

		if (blocksError) {
			console.error("Error fetching blocks:", blocksError);
			return errorResponse("FETCH_FAILED", "Failed to fetch blocks", 500);
		}

		// Increment view count (non-critical, fire and forget)
		void supabase
			.from("landing_pages")
			.update({ view_count: landingPage.view_count + 1 })
			.eq("id", landingPage.id);

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
