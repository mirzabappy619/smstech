import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	notFoundResponse,
	requireAdmin,
} from "@/lib/api-utils";

// Every reason the adjustment modal offers, mapped onto the stored movement
// type. "correction" and "other" used to be rejected outright even though the
// UI presented them.
const ADJUSTMENT_TYPE_BY_REASON = {
	restock: "purchase",
	purchase: "purchase",
	sale: "sale",
	return: "return",
	damage: "damage",
	correction: "adjustment",
	adjustment: "adjustment",
	other: "adjustment",
} as const;

export const ADJUSTMENT_REASONS = Object.keys(
	ADJUSTMENT_TYPE_BY_REASON,
) as (keyof typeof ADJUSTMENT_TYPE_BY_REASON)[];

const adjustSchema = z.object({
	quantity: z
		.number()
		.int({ message: "Quantity must be a whole number" })
		.refine((n) => n !== 0, { message: "Quantity must be non-zero" }),
	reason: z.enum(
		Object.keys(ADJUSTMENT_TYPE_BY_REASON) as [string, ...string[]],
	),
	notes: z.string().optional(),
});

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const { id } = await params;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return errorResponse(
				"INVALID_JSON",
				"Request body must be valid JSON",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const validation = adjustSchema.safeParse(body);
		if (!validation.success) {
			return errorResponse(
				"VALIDATION_ERROR",
				validation.error.errors[0]?.message || "Invalid request data",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const { quantity, reason, notes } = validation.data;
		const supabase = await createAdminClient();

		const { data: inv, error: fetchError } = await supabase
			.from("inventory")
			.select("id, product_id, variation_id, warehouse_id, quantity, reserved_quantity")
			.eq("id", id)
			.single();

		if (fetchError || !inv) {
			return notFoundResponse("Inventory item");
		}

		// The atomic helper enforces both floors: on-hand cannot go below zero,
		// and cannot drop under what is already reserved for orders. The old
		// read-modify-write here checked only the first and could be raced.
		const { data: result, error: rpcError } = await supabase.rpc(
			"apply_stock_movement",
			{
				p_product_id: inv.product_id,
				p_variation_id: inv.variation_id,
				p_warehouse_id: inv.warehouse_id,
				p_delta: quantity,
				p_adjustment_type:
					ADJUSTMENT_TYPE_BY_REASON[
						reason as keyof typeof ADJUSTMENT_TYPE_BY_REASON
					],
				p_reason: notes || reason,
				p_order_id: null,
				p_user_id: authResult.user?.id ?? null,
				p_allow_negative: false,
			},
		);

		if (rpcError) {
			if (rpcError.message?.includes("INSUFFICIENT_STOCK")) {
				const reserved = inv.reserved_quantity ?? 0;
				return errorResponse(
					"INSUFFICIENT_STOCK",
					reserved > 0
						? `Only ${inv.quantity - reserved} unit(s) are free to remove — ${reserved} are reserved for open orders.`
						: `Only ${inv.quantity} unit(s) on hand.`,
					HTTP_STATUS.BAD_REQUEST,
				);
			}
			console.error("Stock adjustment failed:", rpcError);
			return errorResponse(
				"UPDATE_FAILED",
				"Failed to update inventory",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		await supabase
			.from("inventory")
			.update({ last_counted_at: new Date().toISOString() })
			.eq("id", id);

		const { data: updated } = await supabase
			.from("inventory")
			.select("id, quantity, reserved_quantity, available_quantity")
			.eq("id", id)
			.single();

		return jsonResponse({
			...updated,
			quantity_before: result?.[0]?.quantity_before ?? inv.quantity,
			quantity_after: result?.[0]?.quantity_after ?? inv.quantity + quantity,
		});
	} catch (error) {
		console.error("Stock adjustment error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
