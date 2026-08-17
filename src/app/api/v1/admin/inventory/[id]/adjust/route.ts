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

const adjustSchema = z.object({
	quantity: z
		.number()
		.int()
		.refine((n) => n !== 0, { message: "Quantity must be non-zero" }),
	reason: z.enum(["restock", "sale", "return", "adjustment", "damage"]),
	notes: z.string().optional(),
});

const adjustmentTypeMap: Record<string, string> = {
	restock: "purchase",
	sale: "sale",
	return: "return",
	adjustment: "adjustment",
	damage: "damage",
};

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

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
				"Invalid request data",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const { quantity, reason, notes } = validation.data;
		const supabase = await createAdminClient();

		const { data: inv, error: fetchError } = await supabase
			.from("inventory")
			.select("id, quantity")
			.eq("id", id)
			.single();

		if (fetchError || !inv) {
			return notFoundResponse("Inventory item");
		}

		const newQuantity = (inv.quantity as number) + quantity;
		if (newQuantity < 0) {
			return errorResponse(
				"INSUFFICIENT_STOCK",
				"Cannot reduce stock below zero",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const { data: updated, error: updateError } = await supabase
			.from("inventory")
			.update({
				quantity: newQuantity,
				last_counted_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.select()
			.single();

		if (updateError) {
			return errorResponse(
				"UPDATE_FAILED",
				"Failed to update inventory",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Log the stock adjustment
		await supabase.from("inventory_logs").insert({
			inventory_id: id,
			adjustment_type: adjustmentTypeMap[reason] || "adjustment",
			quantity_change: quantity,
			quantity_before: inv.quantity,
			quantity_after: newQuantity,
			reason: notes || reason,
		});

		return jsonResponse(updated);
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
