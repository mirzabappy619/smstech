import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
	paginatedResponse,
	withAuth,
	parsePagination
} from "@/lib/api-utils";
import { productSchema } from "@/lib/schemas";
import { allProducts } from "@/data/products";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const { page, limit } = parsePagination(searchParams, {
			defaultLimit: 50,
			maxLimit: 100,
		});
		const search = searchParams.get("search");
		const featured = searchParams.get("featured");
		const category = searchParams.get("category") || searchParams.get("category_id") || searchParams.get("cat");
		const brand = searchParams.get("brand");
		const sort = searchParams.get("sort") || "created_at";
		const order = (searchParams.get("order") as "asc" | "desc") || "desc";
		const showAll = searchParams.get("show_all") === "true";

		const supabase = await createServerClient();
		const offset = (page - 1) * limit;

		let dbProducts: any[] = [];
		let dbCount = 0;
		let useFallback = false;

		try {
			let query = supabase
				.from("products")
				.select(
					"*, category:categories(id, name, slug), variations:product_variations(*)",
					{ count: "exact" },
				);

			if (!showAll) {
				query = query.eq("is_active", true);
			}

			if (search)
				query = query.or(
					"name.ilike.%" + search + "%,description.ilike.%" + search + "%",
				);
			if (featured === "true") query = query.eq("is_featured", true);
			if (category) query = query.eq("category_id", category);
			query = query
				.order(sort, { ascending: order === "asc" })
				.range(offset, offset + limit - 1);

			const { data, error, count } = await query;
			if (!error && data && data.length > 0) {
				dbProducts = data;
				dbCount = count || data.length;
			} else {
				useFallback = true;
			}
		} catch {
			useFallback = true;
		}

		if (useFallback) {
			let list = [...allProducts];

			if (category) {
				list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase() || p.subcategory.toLowerCase() === category.toLowerCase());
			}

			if (brand) {
				list = list.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
			}

			if (search) {
				const q = search.toLowerCase();
				list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.subcategory.toLowerCase().includes(q));
			}

			if (featured === "true") {
				list = list.filter((p) => p.badges.includes("Hot Deal") || p.badges.includes("Best Seller"));
			}

			if (sort === "price") {
				list.sort((a, b) => order === "asc" ? a.price - b.price : b.price - a.price);
			} else if (sort === "rating") {
				list.sort((a, b) => b.rating - a.rating);
			}

			const paginated = list.slice(offset, offset + limit);
			return paginatedResponse(paginated, page, limit, list.length);
		}

		return paginatedResponse(dbProducts, page, limit, dbCount);
	} catch (error) {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

export async function POST(request: NextRequest) {
	return withAuth(request, async (req, user) => {
		if (user.role !== "admin" && user.role !== "owner")
			return errorResponse("FORBIDDEN", "Forbidden", 403);
		try {
			const body = await req.json();
			const validation = productSchema.safeParse(body);
			if (!validation.success) return validationErrorResponse(validation.error);

			const supabase = await createServerClient();
			const { data: product, error } = await supabase
				.from("products")
				.insert(validation.data)
				.select()
				.single();
			if (error)
				return errorResponse(
					"PRODUCT_CREATION_FAILED",
					"Failed to create product",
					500,
				);
			return jsonResponse(product);
		} catch (error) {
			return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
		}
	});
}
