import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import {
	errorResponse,
	jsonResponse,
	getOptionalAuth,
} from "@/lib/api-utils";

function getSessionId(request: NextRequest): string | null {
	return (
		request.headers.get("x-session-id") ||
		request.cookies.get("session-id")?.value ||
		null
	);
}

async function resolveCartId(
	supabase: Awaited<ReturnType<typeof createServerClient>>,
	userId: string | null,
	sessionId: string | null,
): Promise<string | null> {
	if (userId) {
		const { data: userData } = await supabase
			.from("users")
			.select("id")
			.eq("auth_id", userId)
			.single();
		if (!userData) return null;
		const { data: cart } = await supabase
			.from("carts")
			.select("id")
			.eq("user_id", userData.id)
			.single();
		return cart?.id ?? null;
	}
	if (sessionId) {
		const { data: cart } = await supabase
			.from("carts")
			.select("id")
			.eq("session_id", sessionId)
			.single();
		return cart?.id ?? null;
	}
	return null;
}

/**
 * PUT /api/v1/cart/:itemId
 * Update quantity of a cart item
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ itemId: string }> },
) {
	try {
		const { itemId } = await params;
		const body = await request.json();
		const { quantity } = z
			.object({ quantity: z.number().int().min(1).max(100) })
			.parse(body);

		const user = await getOptionalAuth(request);
		const supabase = await createServerClient();
		const cartId = await resolveCartId(
			supabase,
			user?.id ?? null,
			getSessionId(request),
		);

		if (!cartId)
			return errorResponse("CART_NOT_FOUND", "Cart not found", 404);

		const { data: item } = await supabase
			.from("cart_items")
			.select("id, unit_price")
			.eq("id", itemId)
			.eq("cart_id", cartId)
			.single();

		if (!item)
			return errorResponse("ITEM_NOT_FOUND", "Cart item not found", 404);

		const { data: updated, error } = await supabase
			.from("cart_items")
			.update({ quantity, total_price: item.unit_price * quantity })
			.eq("id", itemId)
			.select()
			.single();

		if (error)
			return errorResponse("UPDATE_FAILED", "Failed to update item", 500);

		return jsonResponse(updated);
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

/**
 * DELETE /api/v1/cart/:itemId
 * Remove a single item from the cart
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ itemId: string }> },
) {
	try {
		const { itemId } = await params;

		const user = await getOptionalAuth(request);
		const supabase = await createServerClient();
		const cartId = await resolveCartId(
			supabase,
			user?.id ?? null,
			getSessionId(request),
		);

		if (!cartId)
			return errorResponse("CART_NOT_FOUND", "Cart not found", 404);

		const { error } = await supabase
			.from("cart_items")
			.delete()
			.eq("id", itemId)
			.eq("cart_id", cartId);

		if (error)
			return errorResponse("DELETE_FAILED", "Failed to remove item", 500);

		return jsonResponse({ deleted: true });
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
