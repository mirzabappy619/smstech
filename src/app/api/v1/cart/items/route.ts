import { NextRequest } from "next/server";
import { z } from "zod";
// Cart routes run under the service role: a guest cart is keyed by an opaque
// session id that RLS cannot verify. Every query below is scoped explicitly by
// the caller's user id or session id.
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	jsonResponse,
	validationErrorResponse,
	getOptionalAuth,
} from "@/lib/api-utils";

const addItemSchema = z.object({
	// Accept both camelCase (from useCart hook) and snake_case (for flexibility)
	productId: z.string().uuid().optional(),
	product_id: z.string().uuid().optional(),
	variationId: z.string().uuid().nullable().optional(),
	variation_id: z.string().uuid().nullable().optional(),
	quantity: z.number().int().min(1).max(100),
}).transform((data) => ({
	product_id: (data.product_id ?? data.productId)!,
	variation_id: data.variation_id ?? data.variationId ?? null,
	quantity: data.quantity,
})).refine((data) => !!data.product_id, {
	message: "productId is required",
	path: ["productId"],
});

function getSessionId(request: NextRequest): string {
	return (
		request.headers.get("x-session-id") ||
		request.cookies.get("session-id")?.value ||
		crypto.randomUUID()
	);
}

/**
 * POST /api/v1/cart/items
 * Add an item to the cart (used by useCart hook with camelCase body)
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validation = addItemSchema.safeParse(body);
		if (!validation.success) return validationErrorResponse(validation.error);

		const { product_id, variation_id, quantity } = validation.data;
		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();

		// Verify product exists and is active
		const { data: product } = await supabase
			.from("products")
			.select("id, base_price")
			.eq("id", product_id)
			.eq("is_active", true)
			.single();
		if (!product)
			return errorResponse("PRODUCT_NOT_FOUND", "Product not found", 404);

		let cartId: string;
		let sessionId: string | undefined;

		if (user) {
			const { data: userData } = await supabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();
			if (!userData)
				return errorResponse("USER_NOT_FOUND", "User profile not found", 404);

			let { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("user_id", userData.id)
				.single();
			if (!cart) {
				const { data: newCart, error } = await supabase
					.from("carts")
					.insert({ user_id: userData.id })
					.select("id")
					.single();
				if (error)
					return errorResponse("CART_CREATION_FAILED", "Failed to create cart", 500);
				cart = newCart;
			}
			cartId = cart.id;
		} else {
			sessionId = getSessionId(request);
			let { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("session_id", sessionId)
				.single();
			if (!cart) {
				const { data: newCart, error } = await supabase
					.from("carts")
					.insert({ session_id: sessionId })
					.select("id")
					.single();
				if (error)
					return errorResponse("CART_CREATION_FAILED", "Failed to create cart", 500);
				cart = newCart;
			}
			cartId = cart.id;
		}

		// Upsert: increment quantity if item already in cart
		const { data: existingItem } = await supabase
			.from("cart_items")
			.select("id, quantity")
			.eq("cart_id", cartId)
			.eq("product_id", product_id)
			.is("variation_id", variation_id)
			.maybeSingle();

		let cartItem;
		if (existingItem) {
			const newQty = existingItem.quantity + quantity;
			const { data: updated, error } = await supabase
				.from("cart_items")
				.update({ quantity: newQty, total_price: product.base_price * newQty })
				.eq("id", existingItem.id)
				.select()
				.single();
			if (error)
				return errorResponse("CART_ADD_FAILED", "Failed to add to cart", 500);
			cartItem = updated;
		} else {
			const { data: inserted, error } = await supabase
				.from("cart_items")
				.insert({
					cart_id: cartId,
					product_id,
					variation_id,
					quantity,
					unit_price: product.base_price,
					total_price: product.base_price * quantity,
				})
				.select()
				.single();
			if (error)
				return errorResponse("CART_ADD_FAILED", "Failed to add to cart", 500);
			cartItem = inserted;
		}

		const response = jsonResponse(cartItem);
		if (!user && sessionId) {
			response.cookies.set("session-id", sessionId, {
				httpOnly: true,
				maxAge: 60 * 60 * 24 * 30,
				sameSite: "lax",
			});
		}
		return response;
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
