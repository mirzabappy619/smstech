import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	requireAdmin,
	validateRequest,
} from "@/lib/api-utils";

const createCouponSchema = z.object({
	code: z
		.string()
		.trim()
		.min(1)
		.max(50)
		.regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, numbers, - or _"),
	description: z.string().max(500).nullable().optional(),
	discount_type: z.enum(["percentage", "fixed", "free_shipping"]),
	discount_value: z.number().min(0),
	min_purchase_amount: z.number().min(0).nullable().optional(),
	max_discount_amount: z.number().min(0).nullable().optional(),
	usage_limit: z.number().int().min(1).nullable().optional(),
	valid_from: z.string(),
	valid_until: z.string().nullable().optional(),
	is_active: z.boolean().default(true),
});

// Map DB row → page-facing shape
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

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();

		const { data: coupons, error } = await supabase
			.from("coupons")
			.select("*")
			.order("created_at", { ascending: false });

		if (error) {
			return errorResponse(
				"COUPONS_FETCH_FAILED",
				"Failed to fetch coupons",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return jsonResponse((coupons || []).map(mapCoupon));
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const validation = await validateRequest(request, createCouponSchema);
		if (validation.error) return validation.error;

		const {
			code,
			description,
			discount_type,
			discount_value,
			min_purchase_amount,
			max_discount_amount,
			usage_limit,
			valid_from,
			valid_until,
			is_active,
		} = validation.data;

		const supabase = await createAdminClient();

		const { data: coupon, error } = await supabase
			.from("coupons")
			.insert({
				code: code.toUpperCase(),
				type: discount_type,
				value: discount_value,
				min_order_amount: min_purchase_amount ?? null,
				max_discount_amount: max_discount_amount ?? null,
				max_uses: usage_limit ?? null,
				starts_at: valid_from,
				expires_at: valid_until ?? null,
				is_active,
				metadata: description ? { description } : {},
			})
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
				"COUPON_CREATE_FAILED",
				"Failed to create coupon",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return jsonResponse(mapCoupon(coupon), HTTP_STATUS.CREATED);
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}
