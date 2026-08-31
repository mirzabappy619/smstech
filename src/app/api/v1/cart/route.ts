import { NextRequest } from "next/server";
// Cart routes run under the service role: a guest cart is keyed by an opaque
// session id that RLS cannot verify. Every query below is scoped explicitly by
// the caller's user id or session id.
import { createAdminClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
	getOptionalAuth,
} from "@/lib/api-utils";
import { z } from "zod";

const addToCartSchema = z.object({
	product_id: z.string().uuid(),
	variation_id: z.string().uuid().optional().nullable(),
	quantity: z.number().int().min(1).max(100),
});

// Helper to get or create session ID for guest users
function getSessionId(request: NextRequest): string {
	const sessionId =
		request.headers.get("x-session-id") ||
		request.cookies.get("session-id")?.value;
	if (!sessionId) {
		// Generate a new session ID
		return crypto.randomUUID();
	}
	return sessionId;
}

export async function GET(request: NextRequest) {
	try {
		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();

		if (user) {
			// Get user's internal ID from their auth_id
			const { data: userData } = await supabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();

			if (!userData) {
				return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
			}

			// Authenticated user cart
			const { data: cart, error } = await supabase
				.from("carts")
				.select(
					"*, items:cart_items(*, product:products(id, name, slug, images, base_price))",
				)
				.eq("user_id", userData.id)
				.single();

			if (error && error.code === "PGRST116") {
				const { data: newCart } = await supabase
					.from("carts")
					.insert({ user_id: userData.id })
					.select()
					.single();
				return jsonResponse({ ...newCart, items: [] });
			}

			if (error)
				return errorResponse("CART_FETCH_FAILED", "Failed to fetch cart", 500);
			return jsonResponse(cart);
		} else {
			// Guest cart - use session-based storage
			const sessionId = getSessionId(request);

			const { data: cart, error } = await supabase
				.from("carts")
				.select(
					"*, items:cart_items(*, product:products(id, name, slug, images, base_price))",
				)
				.eq("session_id", sessionId)
				.single();

			if (error && error.code === "PGRST116") {
				const { data: newCart } = await supabase
					.from("carts")
					.insert({ session_id: sessionId })
					.select()
					.single();

				const response = jsonResponse({ ...newCart, items: [] });
				response.cookies.set("session-id", sessionId, {
					httpOnly: true,
					maxAge: 60 * 60 * 24 * 30, // 30 days
					sameSite: "lax",
				});
				return response;
			}

			if (error)
				return errorResponse("CART_FETCH_FAILED", "Failed to fetch cart", 500);

			const response = jsonResponse(cart);
			response.cookies.set("session-id", sessionId, {
				httpOnly: true,
				maxAge: 60 * 60 * 24 * 30, // 30 days
				sameSite: "lax",
			});
			return response;
		}
	} catch (error) {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const validation = addToCartSchema.safeParse(body);
		if (!validation.success) return validationErrorResponse(validation.error);

		const { product_id, variation_id, quantity } = validation.data;
		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();

		const { data: product } = await supabase
			.from("products")
			.select("id, base_price")
			.eq("id", product_id)
			.eq("is_active", true)
			.single();
		if (!product)
			return errorResponse("PRODUCT_NOT_FOUND", "Product not found", 404);

		let cartData;
		let sessionId;

		if (user) {
			// Get user's internal ID from their auth_id
			const { data: userData } = await supabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();

			if (!userData) {
				return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
			}

			// Authenticated user cart
			let { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("user_id", userData.id)
				.single();
			if (!cart) {
				const { data: newCart, error: newCartError } = await supabase
					.from("carts")
					.insert({ user_id: userData.id })
					.select("id")
					.single();
				if (newCartError) {
					console.error("Failed to create user cart:", newCartError);
					return errorResponse(
						"CART_CREATION_FAILED",
						"Failed to create cart",
						500,
					);
				}
				cart = newCart;
			}
			cartData = cart;
		} else {
			// Guest cart
			sessionId = getSessionId(request);

			let { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("session_id", sessionId)
				.single();
			if (!cart) {
				const { data: newCart, error: newCartError } = await supabase
					.from("carts")
					.insert({ session_id: sessionId })
					.select("id")
					.single();
				if (newCartError) {
					console.error("Failed to create guest cart:", newCartError);
					if (newCartError.code === "42501") {
						return errorResponse(
							"GUEST_CART_NOT_SUPPORTED",
							"Guest carts are not enabled. Please log in to add items to cart.",
							403,
						);
					}
					return errorResponse(
						"CART_CREATION_FAILED",
						"Failed to create cart",
						500,
					);
				}
				cart = newCart;
			}
			cartData = cart;
		}

		if (!cartData) {
			return errorResponse(
				"CART_NOT_FOUND",
				"Unable to create or find cart",
				500,
			);
		}

		// Check if item already exists in cart (same product + variation)
		const { data: existingItem } = await supabase
			.from("cart_items")
			.select("id, quantity")
			.eq("cart_id", cartData.id)
			.eq("product_id", product_id)
			.is("variation_id", variation_id ?? null)
			.maybeSingle();

		let cartItem;
		if (existingItem) {
			// Increment quantity
			const newQty = existingItem.quantity + quantity;
			const { data: updated, error } = await supabase
				.from("cart_items")
				.update({
					quantity: newQty,
					total_price: product.base_price * newQty,
				})
				.eq("id", existingItem.id)
				.select()
				.single();
			if (error) {
				console.error("Failed to update cart item:", error);
				return errorResponse("CART_ADD_FAILED", "Failed to add to cart", 500);
			}
			cartItem = updated;
		} else {
			const { data: inserted, error } = await supabase
				.from("cart_items")
				.insert({
					cart_id: cartData.id,
					product_id,
					variation_id: variation_id ?? null,
					quantity,
					unit_price: product.base_price,
					total_price: product.base_price * quantity,
				})
				.select()
				.single();
			if (error) {
				console.error("Failed to add cart item:", error);
				if (error.code === "23505") {
					return errorResponse(
						"ITEM_ALREADY_IN_CART",
						"This item is already in your cart",
						409,
					);
				}
				return errorResponse("CART_ADD_FAILED", "Failed to add to cart", 500);
			}
			cartItem = inserted;
		}

		const response = jsonResponse(cartItem);

		// Set session cookie for guest users
		if (!user && sessionId) {
			response.cookies.set("session-id", sessionId, {
				httpOnly: true,
				maxAge: 60 * 60 * 24 * 30, // 30 days
				sameSite: "lax",
			});
		}

		return response;
	} catch (error) {
		console.error("Cart POST error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// Clear all items from cart
export async function DELETE(request: NextRequest) {
	try {
		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();

		let cartId: string | null = null;

		if (user) {
			// Get user's internal ID from their auth_id
			const { data: userData } = await supabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();

			if (!userData) {
				return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
			}

			// Get authenticated user's cart
			const { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("user_id", userData.id)
				.single();
			cartId = cart?.id || null;
		} else {
			// Get guest cart
			const sessionId = getSessionId(request);
			const { data: cart } = await supabase
				.from("carts")
				.select("id")
				.eq("session_id", sessionId)
				.single();
			cartId = cart?.id || null;
		}

		if (!cartId) {
			return jsonResponse({ message: "Cart is already empty" });
		}

		// Delete all items from the cart
		const { error } = await supabase
			.from("cart_items")
			.delete()
			.eq("cart_id", cartId);

		if (error) {
			console.error("Failed to clear cart:", error);
			return errorResponse("CART_CLEAR_FAILED", "Failed to clear cart", 500);
		}

		return jsonResponse({ message: "Cart cleared successfully" });
	} catch (error) {
		console.error("Cart DELETE error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
