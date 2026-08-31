import { NextRequest } from "next/server";
import { z } from "zod";
// Cart routes run under the service role: a guest cart is keyed by an opaque
// session id that RLS cannot verify. Every query below is scoped explicitly by
// the caller's user id or session id.
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	jsonResponse,
	getOptionalAuth,
	validationErrorResponse,
} from "@/lib/api-utils";

function getSessionId(request: NextRequest): string | null {
	return (
		request.headers.get("x-session-id") ||
		request.cookies.get("session-id")?.value ||
		null
	);
}

async function resolveCart(
	supabase: Awaited<ReturnType<typeof createAdminClient>>,
	userId: string | null,
	sessionId: string | null,
) {
	if (userId) {
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", userId)
			.single();
		if (!userData) return null;
		const { data: cart } = await supabase
			.from("carts")
			.select("id, subtotal, shipping_amount")
			.eq("user_id", userData.id)
			.single();
		return cart ?? null;
	}
	if (sessionId) {
		const { data: cart } = await supabase
			.from("carts")
			.select("id, subtotal, shipping_amount")
			.eq("session_id", sessionId)
			.single();
		return cart ?? null;
	}
	return null;
}

/**
 * POST /api/v1/cart/coupon
 * Apply a coupon code to the cart
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => null);
		const parsed = z
			.object({ code: z.string().trim().min(1) })
			.safeParse(body);

		// A missing/blank code is a bad request, not a server error.
		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}
		const { code } = parsed.data;

		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();
		const cart = await resolveCart(
			supabase,
			user?.id ?? null,
			getSessionId(request),
		);

		if (!cart) return errorResponse("CART_NOT_FOUND", "Cart not found", 404);

		// Find coupon
		const { data: coupon } = await supabase
			.from("coupons")
			.select("id, type, value, min_order_amount, max_discount_amount, max_uses, uses_count, expires_at, starts_at, is_active")
			.eq("code", code.toUpperCase())
			.single();

		if (!coupon || !coupon.is_active)
			return errorResponse("INVALID_COUPON", "Coupon not found or inactive", 404);

		// Check validity window
		const now = new Date();
		if (coupon.starts_at && new Date(coupon.starts_at) > now)
			return errorResponse("COUPON_NOT_STARTED", "Coupon is not yet valid", 400);
		if (coupon.expires_at && new Date(coupon.expires_at) < now)
			return errorResponse("COUPON_EXPIRED", "Coupon has expired", 400);

		// Check usage limit
		if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses)
			return errorResponse("COUPON_EXHAUSTED", "Coupon usage limit reached", 400);

		// Check minimum order amount
		if (coupon.min_order_amount && cart.subtotal < coupon.min_order_amount)
			return errorResponse(
				"ORDER_TOO_SMALL",
				`Minimum order amount is ${coupon.min_order_amount}`,
				400,
			);

		// Calculate discount
		let discountAmount = 0;
		if (coupon.type === "percentage") {
			discountAmount = (cart.subtotal * coupon.value) / 100;
			if (coupon.max_discount_amount) {
				discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
			}
		} else if (coupon.type === "fixed") {
			discountAmount = Math.min(coupon.value, cart.subtotal);
		} else if (coupon.type === "free_shipping") {
			discountAmount = cart.shipping_amount ?? 0;
		}
		discountAmount = Math.round(discountAmount * 100) / 100;

		const newTotal = Math.max(
			0,
			cart.subtotal - discountAmount + (cart.shipping_amount ?? 0),
		);

		// Apply coupon to cart
		const { data: updatedCart, error } = await supabase
			.from("carts")
			.update({
				coupon_id: coupon.id,
				discount_amount: discountAmount,
				total: newTotal,
			})
			.eq("id", cart.id)
			.select("id, coupon_id, subtotal, discount_amount, shipping_amount, total")
			.single();

		if (error)
			return errorResponse("COUPON_APPLY_FAILED", "Failed to apply coupon", 500);

		return jsonResponse({
			...updatedCart,
			coupon: { id: coupon.id, code, type: coupon.type, value: coupon.value },
			discount_amount: discountAmount,
		});
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

/**
 * DELETE /api/v1/cart/coupon
 * Remove the applied coupon from the cart
 */
export async function DELETE(request: NextRequest) {
	try {
		const user = await getOptionalAuth(request);
		const supabase = await createAdminClient();
		const cart = await resolveCart(
			supabase,
			user?.id ?? null,
			getSessionId(request),
		);

		if (!cart) return errorResponse("CART_NOT_FOUND", "Cart not found", 404);

		const { data: updatedCart, error } = await supabase
			.from("carts")
			.update({
				coupon_id: null,
				discount_amount: 0,
				total: cart.subtotal + (cart.shipping_amount ?? 0),
			})
			.eq("id", cart.id)
			.select("id, subtotal, discount_amount, shipping_amount, total")
			.single();

		if (error)
			return errorResponse("COUPON_REMOVE_FAILED", "Failed to remove coupon", 500);

		return jsonResponse(updatedCart);
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
