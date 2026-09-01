import { NextRequest } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";
import {
	jsonResponse,
	errorResponse,
	validationErrorResponse,
	paginatedResponse,
	getOptionalAuth,
} from "@/lib/api-utils";
import { paymentService } from "@/lib/payment";
import { readStoreSettings } from "@/lib/store-settings";
import {
	findOrCreateCustomer,
	resolveCustomerIds,
	resolveProfileId,
} from "@/lib/account";
// MetaPixelService import removed — CAPI Purchase is now handled exclusively
// by the Supabase Edge Function (capi-purchase) triggered via DB webhook on
// INSERT to the orders table.  The browser Pixel fires from the checkout page.
// Having a third call here caused every purchase to count as 2 conversions.
import { z } from "zod";
import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";

// Helper to get session ID for guest users
function getSessionId(request: NextRequest): string | null {
	return (
		request.headers.get("x-session-id") ||
		request.cookies.get("session-id")?.value ||
		null
	);
}

const createOrderSchema = z.object({
	items: z
		.array(
			z.object({
				product_id: z.string().uuid(),
				variation_id: z.string().uuid().optional(),
				quantity: z.number().int().positive(),
			}),
		)
		.optional(), // Made optional - will use cart items if not provided
	shipping_address: z.object({
		name: z.string().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		first_name: z.string().optional(),
		last_name: z.string().optional(),
		address1: z.string().optional(),
		address2: z.string().optional(),
		address_line1: z.string().optional(),
		address_line2: z.string().optional(),
		city: z.string().optional().default(""),
		state: z.string().optional().default(""),
		postalCode: z.string().optional(),
		postal_code: z.string().optional(),
		country: z.string().optional().default("BD"),
		phone: z.string().optional().refine(val => !val || isValidBDPhone(val), {
			message: BD_PHONE_ERROR_MESSAGE,
		}),
		email: z.string().email().optional(),
	}),
	billing_address: z.any().optional(),
	shipping_method: z.string().min(1),
	payment_method: z
		.enum(["card", "cash_on_delivery", "paypal"])
		.default("card"),
	coupon_code: z.string().optional().nullable(),
	notes: z.string().optional(),
	source: z.string().optional(),
	create_payment_intent: z.boolean().default(true),
	// Facebook match quality signals forwarded to the CAPI edge function
	fbc: z.string().optional().nullable(),
	fbp: z.string().optional().nullable(),
});

// GET /api/v1/orders - List user's orders
export async function GET(request: NextRequest) {
	try {
		const supabase = await createServerClient();

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
		}

		const profileId = await resolveProfileId(supabase, user.id);
		if (!profileId) {
			return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
		}

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
		const status = searchParams.get("status");

		// Orders reference customers.id, not users.id.
		const customerIds = await resolveCustomerIds(supabase, profileId);
		if (customerIds.length === 0) {
			return paginatedResponse([], page, limit, 0);
		}

		let query = supabase
			.from("orders")
			.select("*", { count: "exact" })
			.in("customer_id", customerIds)
			.order("created_at", { ascending: false });

		if (status) {
			query = query.eq("status", status);
		}

		const from = (page - 1) * limit;
		const to = from + limit - 1;
		query = query.range(from, to);

		const { data: orders, count, error } = await query;

		if (error) {
			return errorResponse(
				"ORDERS_FETCH_FAILED",
				"Failed to fetch orders",
				500,
			);
		}

		return paginatedResponse(orders || [], page, limit, count || 0);
	} catch (error) {
		console.error("Get orders error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// POST /api/v1/orders - Create new order
export async function POST(request: NextRequest) {
	try {
		const supabase = await createServerClient();
		const adminSupabase = await createAdminClient();

		// Support both authenticated and guest checkout
		const user = await getOptionalAuth(request);
		const sessionId = getSessionId(request);

		const body = await request.json();
		const validation = createOrderSchema.safeParse(body);

		if (!validation.success) {
			return validationErrorResponse(validation.error);
		}

		// `items` is the only one reassigned below (it falls back to the cart
		// when the request omits it), so the rest stay const.
		let { items } = validation.data;
		const {
			shipping_address,
			billing_address,
			shipping_method,
			payment_method,
			coupon_code,
			notes,
			source,
			create_payment_intent,
			fbc,
			fbp,
		} = validation.data;

		// Normalize address fields (support both camelCase, snake_case, and single name field)
		const fullName = shipping_address.name || "";
		const nameParts = fullName.trim().split(/\s+/);
		const derivedFirstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || "";
		const derivedLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

		const normalizedShippingAddress = {
			name: fullName,
			first_name:
				shipping_address.firstName || shipping_address.first_name || derivedFirstName,
			last_name: shipping_address.lastName || shipping_address.last_name || derivedLastName,
			address_line1:
				shipping_address.address1 || shipping_address.address_line1 || "",
			address_line2:
				shipping_address.address2 || shipping_address.address_line2 || "",
			city: shipping_address.city || "",
			state: shipping_address.state || "",
			postal_code:
				shipping_address.postalCode || shipping_address.postal_code || "",
			country: shipping_address.country || "BD",
			phone: shipping_address.phone ? normalizeBDPhone(shipping_address.phone) : "",
			email: shipping_address.email || "",
		};

		// If no items provided, get from cart
		if (!items || items.length === 0) {
			let cartQuery;
			if (user) {
				// Get user's internal ID from their auth_id
				const { data: userData } = await adminSupabase
					.from("users")
					.select("id")
					.eq("auth_id", user.id)
					.single();

				if (!userData) {
					return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
				}

				cartQuery = adminSupabase
					.from("carts")
					.select("id, items:cart_items(product_id, variation_id, quantity)")
					.eq("user_id", userData.id)
					.single();
			} else if (sessionId) {
				cartQuery = adminSupabase
					.from("carts")
					.select("id, items:cart_items(product_id, variation_id, quantity)")
					.eq("session_id", sessionId)
					.single();
			} else {
				return errorResponse(
					"NO_CART",
					"No cart found. Please add items to your cart.",
					400,
				);
			}

			const { data: cart, error: cartError } = await cartQuery;
			if (cartError || !cart || !cart.items || cart.items.length === 0) {
				return errorResponse("EMPTY_CART", "Your cart is empty", 400);
			}

			items = cart.items.map(
				(item: {
					product_id: string;
					variation_id?: string;
					quantity: number;
				}) => ({
					product_id: item.product_id,
					variation_id: item.variation_id,
					quantity: item.quantity,
				}),
			);
		}

		// Get product details and calculate totals
		const productIds = [...new Set(items.map((i) => i.product_id))];
		const { data: products, error: productsError } = await adminSupabase
			.from("products")
			.select("id, name, sku, base_price, is_preorder, product_variations(id, name, sku, price)")
			.in("id", productIds);

		if (productsError || !products) {
			return errorResponse(
				"PRODUCTS_FETCH_FAILED",
				"Failed to fetch products",
				500,
			);
		}

		// Pre-order products are reserved through /api/v1/pre-bookings with a
		// deposit; they must never enter a normal order.
		const preorderItems = products.filter((p) => p.is_preorder);
		if (preorderItems.length > 0) {
			return errorResponse(
				"PREORDER_NOT_ORDERABLE",
				`${preorderItems.map((p) => p.name).join(", ")} ${preorderItems.length > 1 ? "are" : "is"} pre-order only. Please reserve with a deposit from the product page.`,
				400,
			);
		}

		// Build order items and calculate subtotal
		let subtotal = 0;
		const orderItems = items.map((item) => {
			const product = products.find((p) => p.id === item.product_id);
			if (!product) throw new Error(`Product ${item.product_id} not found`);

			let unitPrice = Number(product.base_price) || 0;
			let variationName: string | null = null;
			let itemSku: string = product.sku || product.id;

			if (item.variation_id) {
				const variation = product.product_variations?.find(
					(v: { id: string }) => v.id === item.variation_id,
				);
				if (variation) {
					unitPrice = Number(variation.price) || 0;
					variationName = variation.name;
					itemSku = variation.sku || `${itemSku}-${variation.id}`;
				}
			}

			const totalPrice = unitPrice * item.quantity;
			subtotal += totalPrice;

			return {
				product_id: item.product_id,
				variation_id: item.variation_id || null,
				sku: itemSku,
				name: product.name,
				quantity: item.quantity,
				unit_price: unitPrice,
				total_price: totalPrice,
				attributes: variationName ? { variation_name: variationName } : {},
			};
		});

		// Calculate shipping — look up price from store settings
		let shippingAmount = 0;
		try {
			const settings = await readStoreSettings(adminSupabase);
			const methods = settings.shipping_methods;

			if (Array.isArray(methods)) {
				const matched = methods.find((m) => m.id === shipping_method);
				shippingAmount =
					Number(matched?.price ?? settings.default_shipping_cost ?? 0) || 0;
			} else {
				shippingAmount = Number(settings.default_shipping_cost ?? 0) || 0;
			}
		} catch (err) {
			console.error("Shipping calculation error:", err);
			shippingAmount = 0;
		}

		// Calculate discount if coupon provided
		let discountAmount = 0;
		if (coupon_code) {
			const { data: coupon } = await supabase
				.from("coupons")
				.select("*")
				.eq("code", coupon_code.toUpperCase())
				.eq("is_active", true)
				.single();

			if (coupon) {
				const discountValue = Number(coupon.discount_value) || 0;
				if (coupon.discount_type === "percentage") {
					discountAmount = Number(subtotal) * (discountValue / 100);
					if (coupon.max_discount) {
						discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
					}
				} else {
					discountAmount = discountValue;
				}
			}
		}
		discountAmount = Number(discountAmount) || 0;

		const taxAmount = 0;

		// Calculate total - ensure all values are numbers
		const totalAmount = Number(subtotal) + Number(shippingAmount) - Number(discountAmount);

		// Ensure total is never null/NaN
		if (!Number.isFinite(totalAmount)) {
			console.error("Invalid total calculation:", { subtotal, shippingAmount, discountAmount, totalAmount });
			return errorResponse(
				"INVALID_CALCULATION",
				"Failed to calculate order total",
				500,
			);
		}

		// Generate order number
		const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

		// Get user's internal ID if authenticated
		let internalUserId = null;
		if (user) {
			const { data: userData } = await adminSupabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();

			if (!userData) {
				return errorResponse("USER_NOT_FOUND", "User profile not found", 404);
			}
			internalUserId = userData.id;
		}

		// Orders reference customers.id, not users.id — guests included.
		const customer = await findOrCreateCustomer(adminSupabase, {
			profileId: internalUserId,
			name: normalizedShippingAddress.name,
			email: normalizedShippingAddress.email || user?.email,
			phone: normalizedShippingAddress.phone,
		});

		if ("error" in customer) {
			console.error("Customer resolution failed:", customer.error);
			return errorResponse(
				"CUSTOMER_CREATION_FAILED",
				"Failed to attach the order to a customer record",
				500,
			);
		}

		// Create order (support both authenticated and guest users)
		const { data: order, error: orderError } = await adminSupabase
			.from("orders")
			.insert({
				customer_id: customer.id,
				customer_name: normalizedShippingAddress.name || null,
				customer_phone: normalizedShippingAddress.phone || null,
				customer_email:
					normalizedShippingAddress.email || user?.email || null,
				address_line1: normalizedShippingAddress.address_line1 || null,
				city: normalizedShippingAddress.city || null,
				order_number: orderNumber,
				status: "pending",
				payment_status:
					payment_method === "cash_on_delivery" ? "pending" : "pending",
				payment_method: payment_method,
				subtotal,
				tax_amount: taxAmount,
				shipping_amount: shippingAmount,
				discount_amount: discountAmount,
				total: totalAmount,
				currency: "BDT",
				shipping_method,
				shipping_address: normalizedShippingAddress,
				billing_address: billing_address || normalizedShippingAddress,
				coupon_code: coupon_code || null,
				customer_notes: notes || null,
				source: source || "web",
				// Facebook match quality — stored so the capi-purchase edge function
				// can forward them to Meta Conversions API user_data.
				fbc: fbc || null,
				fbp: fbp || null,
			})
			.select()
			.single();

		if (orderError || !order) {
			console.error("Order creation failed:", orderError);
			return errorResponse(
				"ORDER_CREATION_FAILED",
				orderError?.message || "Failed to create order",
				500,
			);
		}

		// Create order items
		const orderItemsWithOrderId = orderItems.map((item) => ({
			...item,
			order_id: order.id,
		}));

		await adminSupabase.from("order_items").insert(orderItemsWithOrderId);

		// Create payment intent if requested and not cash on delivery
		let paymentIntent = null;
		if (create_payment_intent && payment_method !== "cash_on_delivery") {
			const amount = paymentService.calculateAmount(totalAmount, 0, 0, 0);
			const paymentResult = await paymentService.createPaymentIntent({
				amount,
				currency: "BDT",
				metadata: {
					order_id: order.id,
					order_number: orderNumber,
					user_id: user?.id || "guest",
				},
			});

			if (paymentResult.success && paymentResult.paymentIntent) {
				paymentIntent = {
					clientSecret: paymentResult.paymentIntent.client_secret,
					paymentIntentId: paymentResult.paymentIntent.id,
				};

				// Update order with payment intent ID
				await adminSupabase
					.from("orders")
					.update({ payment_intent_id: paymentResult.paymentIntent.id })
					.eq("id", order.id);
			}
		}

		// Clear cart (support both authenticated and guest users)
		if (user?.id) {
			// Get user's internal ID from their auth_id and find their cart
			const { data: userData } = await adminSupabase
				.from("users")
				.select("id")
				.eq("auth_id", user.id)
				.single();

			if (userData) {
				const { data: cart } = await adminSupabase
					.from("carts")
					.select("id")
					.eq("user_id", userData.id)
					.single();

				if (cart) {
					await adminSupabase
						.from("cart_items")
						.delete()
						.eq("cart_id", cart.id);
				}
			}
		} else if (sessionId) {
			// Find guest cart and clear its items
			const { data: cart } = await adminSupabase
				.from("carts")
				.select("id")
				.eq("session_id", sessionId)
				.single();

			if (cart) {
				await adminSupabase.from("cart_items").delete().eq("cart_id", cart.id);
			}
		}

		// ──────────────────────────────────────────────────────────────────────
		// Meta Purchase Tracking — deduplication strategy
		// ──────────────────────────────────────────────────────────────────────
		// Two signals are sent for every purchase — Meta deduplicates them into
		// ONE conversion because both share the same event_id (order.id):
		//
		//  1. Browser Pixel  — fired in checkout/page.tsx *after* this response
		//                       via trackMetaPurchase({ eventId: createdOrder.id })
		//
		//  2. Conversions API — fired by the Supabase Edge Function (capi-purchase)
		//                       triggered automatically by the DB webhook on INSERT
		//                       to the orders table (event_id = order.id)
		//
		// DO NOT add a third MetaPixelService.firePurchaseEvent() call here.
		// That was the source of double-counting reported in Facebook Event Manager.

		return jsonResponse({
			order: {
				id: order.id,
				order_number: order.order_number,
				status: order.status,
				total_amount: order.total,
				currency: order.currency,
			},
			payment: paymentIntent,
		});
	} catch (error) {
		console.error("Create order error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}
