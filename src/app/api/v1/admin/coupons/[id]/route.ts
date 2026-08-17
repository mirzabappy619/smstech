import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	notFoundResponse,
	requireAdmin,
	validateRequest,
} from "@/lib/api-utils";

const updateCouponSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(1)
			.max(50)
			.regex(
				/^[A-Z0-9_-]+$/,
				"Code must be uppercase letters, numbers, - or _",
			)
			.optional(),
		description: z.string().max(500).nullable().optional(),
		discount_type: z.enum(["percentage", "fixed", "free_shipping"]).optional(),
		discount_value: z.number().min(0).optional(),
		min_purchase_amount: z.number().min(0).nullable().optional(),
		max_discount_amount: z.number().min(0).nullable().optional(),
		usage_limit: z.number().int().min(1).nullable().optional(),
		valid_from: z.string().optional(),
		valid_until: z.string().nullable().optional(),
		is_active: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required",
	});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoupon(coupon: Record<string, any>) {
	const metadata =
		typeof coupon.metadata === "object" && coupon.metadata !== null
			? (coupon.metadata as Record<string, unknown>)
			: {};

	return {
		id: coupon.id,
		code: coupon.code,
		description: (metadata.description as string | null) ?? null,
		discount_type: coupon.type,
		discount_value: coupon.value,
		min_purchase_amount: coupon.min_order_amount,
		max_discount_amount: coupon.max_discount_amount,
		usage_limit: coupon.max_uses,
		usage_count: coupon.uses_count,
		valid_from: coupon.starts_at,
		valid_until: coupon.expires_at,
		is_active: coupon.is_active,
		created_at: coupon.created_at,
	};
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id } = await params;

		const validation = await validateRequest(request, updateCouponSchema);
		if (validation.error) return validation.error;

		const updates = validation.data;
		const supabase = await createAdminClient();

		// Fetch existing coupon to merge metadata
		const { data: existing, error: fetchError } = await supabase
			.from("coupons")
			.select("id, metadata")
			.eq("id", id)
			.single();

		if (fetchError || !existing) {
			return notFoundResponse("Coupon");
		}

		const mergedMetadata = {
			...((existing.metadata as Record<string, unknown> | null) || {}),
		};

		if (Object.prototype.hasOwnProperty.call(updates, "description")) {
			if (updates.description != null) {
				mergedMetadata.description = updates.description;
			} else {
				delete mergedMetadata.description;
			}
		}

		const updatePayload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
			metadata: mergedMetadata,
		};

		if (updates.code !== undefined) updatePayload.code = updates.code.toUpperCase();
		if (updates.discount_type !== undefined) updatePayload.type = updates.discount_type;
		if (updates.discount_value !== undefined) updatePayload.value = updates.discount_value;
		if (Object.prototype.hasOwnProperty.call(updates, "min_purchase_amount"))
			updatePayload.min_order_amount = updates.min_purchase_amount ?? null;
		if (Object.prototype.hasOwnProperty.call(updates, "max_discount_amount"))
			updatePayload.max_discount_amount = updates.max_discount_amount ?? null;
		if (Object.prototype.hasOwnProperty.call(updates, "usage_limit"))
			updatePayload.max_uses = updates.usage_limit ?? null;
		if (updates.valid_from !== undefined) updatePayload.starts_at = updates.valid_from;
		if (Object.prototype.hasOwnProperty.call(updates, "valid_until"))
			updatePayload.expires_at = updates.valid_until ?? null;
		if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;

		const { data: coupon, error } = await supabase
			.from("coupons")
			.update(updatePayload)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			if (error.code === "23505") {
				return errorResponse(
					"COUPON_CODE_EXISTS",
					"A coupon with this code already exists",
					HTTP_STATUS.CONFLICT,
				);
			}
			return errorResponse(
				"COUPON_UPDATE_FAILED",
				"Failed to update coupon",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return jsonResponse(mapCoupon(coupon));
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { id } = await params;
		const supabase = await createAdminClient();

		const { data: deleted, error } = await supabase
			.from("coupons")
			.delete()
			.eq("id", id)
			.select("id")
			.maybeSingle();

		if (error) {
			return errorResponse(
				"COUPON_DELETE_FAILED",
				"Failed to delete coupon",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		if (!deleted) {
			return notFoundResponse("Coupon");
		}

		return jsonResponse({ id, deleted: true });
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
