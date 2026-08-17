import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
	paginatedResponse,
	requireAdmin,
} from "@/lib/api-utils";
import { createLandingPageSchema } from "@/app/landing-page-types";

// GET /api/v1/admin/landing-pages - List all landing pages
export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createServerClient();

		// Parse query params
		const searchParams = request.nextUrl.searchParams;
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "20");
		const status = searchParams.get("status");
		const search = searchParams.get("search");

		const offset = (page - 1) * limit;

		// Build query
		let query = supabase
			.from("landing_pages")
			.select("*", { count: "exact" })
			.order("created_at", { ascending: false });

		if (status && (status === "draft" || status === "published")) {
			query = query.eq("status", status);
		}

		if (search) {
			query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
		}

		query = query.range(offset, offset + limit - 1);

		const { data, error, count } = await query;

		if (error) {
			console.error("Error fetching landing pages:", error);
			return errorResponse(
				"FETCH_FAILED",
				"Failed to fetch landing pages",
				500,
			);
		}

		return paginatedResponse(data || [], page, limit, count || 0);
	} catch (error) {
		console.error("Landing pages API error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// POST /api/v1/admin/landing-pages - Create new landing page
export async function POST(request: NextRequest) {
	try {
		const { user, error: authError } = await requireAdmin(request);
		if (authError) {
			console.error("Auth error in POST landing page:", authError);
			return authError;
		}

		const supabase = await createServerClient();

		// Get user info from database
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", user.id)
			.single();

		if (userError) {
			console.error("User lookup error:", userError);
		}

		if (!userData) {
			console.error("User not found for auth_id:", user.id);
			return errorResponse("USER_NOT_FOUND", "User not found", 404);
		}

		console.log("Creating landing page for user:", userData.id);

		// Parse and validate request body
		const body = await request.json();
		const validation = createLandingPageSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		const { title, slug, metaTitle, metaDescription, metaKeywords, blocks } =
			validation.data;

		// Check if slug already exists
		const { data: existing } = await supabase
			.from("landing_pages")
			.select("id")
			.eq("slug", slug)
			.single();

		if (existing) {
			return errorResponse(
				"SLUG_EXISTS",
				"A landing page with this slug already exists",
				400,
			);
		}

		// Create landing page
		const { data: landingPage, error } = await supabase
			.from("landing_pages")
			.insert({
				title,
				slug,
				meta_title: metaTitle,
				meta_description: metaDescription,
				meta_keywords: metaKeywords,
				status: "draft",
				created_by: userData.id,
				updated_by: userData.id,
			})
			.select()
			.single();

		if (error) {
			console.error("Error creating landing page:", error);
			return errorResponse(
				"CREATE_FAILED",
				"Failed to create landing page",
				500,
			);
		}

		// Create blocks if provided
		if (blocks && blocks.length > 0) {
			const blocksToInsert = blocks.map((block) => ({
				landing_page_id: landingPage.id,
				block_type: block.blockType,
				block_data: block.blockData,
				sort_order: block.sortOrder,
				is_active: block.isActive,
			}));

			const { error: blocksError } = await supabase
				.from("landing_page_blocks")
				.insert(blocksToInsert);

			if (blocksError) {
				console.error("Error creating blocks:", blocksError);
				// Delete the landing page if blocks creation fails
				await supabase.from("landing_pages").delete().eq("id", landingPage.id);
				return errorResponse(
					"CREATE_FAILED",
					"Failed to create landing page blocks",
					500,
				);
			}
		}

		return successResponse(landingPage);
	} catch (error) {
		console.error("Create landing page error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
