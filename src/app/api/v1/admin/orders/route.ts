import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	paginatedResponse,
	successResponse,
	requireAdmin,
	HTTP_STATUS,
} from "@/lib/api-utils";
import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";
import { z } from "zod";

const adminCreateOrderSchema = z.object({
	customer_name: z.string().min(2, "Customer name is required"),
	customer_phone: z.string().refine((val) => isValidBDPhone(val), {
		message: BD_PHONE_ERROR_MESSAGE,
	}),
	customer_email: z.string().email().optional().or(z.literal("")),
	address_line1: z.string().min(5, "Address is required"),
	address_line2: z.string().optional(),
	city: z.string().optional().default("Dhaka"),
	state: z.string().optional().default(""),
	postal_code: z.string().optional().default(""),
	country: z.string().optional().default("BD"),
	shipping_method: z.string().default("Standard Delivery"),
	shipping_amount: z.number().min(0).default(60),
	discount_amount: z.number().min(0).default(0),
	payment_method: z.enum(["cash_on_delivery", "card", "bkash", "nagad", "bank_transfer"]).default("cash_on_delivery"),
	payment_status: z.enum(["pending", "paid", "failed"]).default("pending"),
	status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).default("pending"),
	notes: z.string().optional(),
	items: z
		.array(
			z.object({
				product_id: z.string().uuid("Invalid product ID"),
				variation_id: z.string().uuid().optional().nullable(),
				quantity: z.number().int().positive(),
				unit_price: z.number().min(0).optional(),
			}),
		)
		.min(1, "At least one product item is required"),
});

// GET /api/v1/admin/orders - List & search all orders (admin only)
export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();

		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);
		const status = searchParams.get("status");
		const search = searchParams.get("search")?.trim() || "";

		let query = supabase
			.from("orders")
			.select(
				`
				id,
				order_number,
				status,
				total,
				subtotal,
				shipping_amount,
				discount_amount,
				payment_method,
				payment_status,
				shipping_method,
				tracking_number,
				shipping_address,
				source,
				created_at,
				updated_at,
				user_id,
				users!user_id (
					id,
					email,
					first_name,
					last_name,
					phone
				),
				order_items (
					id,
					quantity,
					unit_price,
					total_price,
					name,
					sku,
					attributes,
					products ( id, name, images ),
					product_variations ( id, name )
				)
				`,
				{ count: "exact" },
			)
			.order("created_at", { ascending: false });

		if (status && status !== "all") {
			query = query.eq("status", status);
		}

		if (search) {
			const s = `%${search}%`;
			query = query.or(
				`order_number.ilike.${s},shipping_address->>name.ilike.${s},shipping_address->>first_name.ilike.${s},shipping_address->>last_name.ilike.${s},shipping_address->>phone.ilike.${s},shipping_address->>email.ilike.${s}`
			);
		}

		const from = (page - 1) * limit;
		const to = from + limit - 1;
		query = query.range(from, to);

		const { data: orders, error, count } = await query;

		if (error) {
			console.error("Error fetching orders:", error);
			return errorResponse("DATABASE_ERROR", error.message, 500);
		}

		// Normalize each order into a clean shape
		let normalised = (orders || []).map((order) => {
			const userData = Array.isArray(order.users) ? order.users[0] : order.users;
			const shippingAddr =
				typeof order.shipping_address === "string"
					? JSON.parse(order.shipping_address)
					: (order.shipping_address as Record<string, any>) || {};

			const shippingName =
				shippingAddr.name ||
				`${shippingAddr.first_name || ""} ${shippingAddr.last_name || ""}`.trim();
			const userName = userData
				? `${userData.first_name || ""} ${userData.last_name || ""}`.trim()
				: "";

			const customer_name =
				shippingName ||
				userName ||
				(userData?.email ? userData.email.split("@")[0] : "") ||
				"Guest Customer";
			const customer_email = shippingAddr.email || userData?.email || "No Email";
			const customer_phone = shippingAddr.phone || userData?.phone || null;

			const items = (order.order_items || []) as Record<string, unknown>[];

			const normalisedItems = items.map((item) => {
				const product = (Array.isArray(item.products)
					? item.products[0]
					: item.products) as Record<string, unknown> | null;
				const variation = (Array.isArray(item.product_variations)
					? item.product_variations[0]
					: item.product_variations) as Record<string, unknown> | null;
				const attributes = (item.attributes as Record<string, string> | null) || {};

				return {
					id: item.id,
					quantity: item.quantity,
					unit_price: item.unit_price,
					total_price: item.total_price,
					product_name: (item.name as string) || (product?.name as string) || "Unknown",
					variation_name:
						(variation?.name as string) ||
						(Object.values(attributes || {})[0] as string) ||
						null,
					variation_sku: (item.sku as string) || null,
					product_image: (product?.images as string[] | null)?.[0] || null,
				};
			});

			return {
				id: order.id,
				order_number: order.order_number,
				status: order.status,
				total: Number(order.total || 0),
				subtotal: Number(order.subtotal || 0),
				shipping_amount: Number(order.shipping_amount || 0),
				discount_amount: Number(order.discount_amount || 0),
				items_count: normalisedItems.length,
				items: normalisedItems,
				payment_method: order.payment_method,
				payment_status: order.payment_status || "pending",
				shipping_method: order.shipping_method,
				tracking_number: order.tracking_number,
				shipping_address: shippingAddr,
				source: order.source || "web",
				created_at: order.created_at,
				updated_at: order.updated_at,
				customer_name,
				customer_email,
				customer_phone,
			};
		});

		// Secondary in-memory search filter guarantee (for name, phone, email, order_number)
		if (search) {
			const s = search.toLowerCase();
			normalised = normalised.filter(
				(o) =>
					o.order_number.toLowerCase().includes(s) ||
					o.customer_name.toLowerCase().includes(s) ||
					o.customer_email.toLowerCase().includes(s) ||
					(o.customer_phone && o.customer_phone.toLowerCase().includes(s))
			);
		}

		return paginatedResponse(normalised, page, limit, count || normalised.length);
	} catch (error) {
		console.error("Admin orders GET error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

// POST /api/v1/admin/orders - Create new order directly from Admin Panel
export async function POST(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const body = await request.json();
		const validation = adminCreateOrderSchema.safeParse(body);

		if (!validation.success) {
			const details = validation.error.errors.reduce(
				(acc, err) => {
					const path = err.path.join(".");
					if (!acc[path]) acc[path] = [];
					acc[path].push(err.message);
					return acc;
				},
				{} as Record<string, string[]>,
			);
			return errorResponse("VALIDATION_ERROR", "Invalid order payload", HTTP_STATUS.BAD_REQUEST, details);
		}

		const data = validation.data;
		const adminSupabase = await createAdminClient();

		// Fetch products and variations
		const productIds = [...new Set(data.items.map((i) => i.product_id))];
		const { data: products, error: productsError } = await adminSupabase
			.from("products")
			.select("id, name, sku, base_price, product_variations(id, name, sku, price)")
			.in("id", productIds);

		if (productsError || !products) {
			return errorResponse("PRODUCTS_FETCH_FAILED", "Failed to fetch product details", 500);
		}

		// Calculate order items and subtotal
		let subtotal = 0;
		const orderItemsToInsert = data.items.map((item) => {
			const product = products.find((p) => p.id === item.product_id);
			if (!product) throw new Error(`Product not found: ${item.product_id}`);

			let unitPrice = item.unit_price !== undefined ? item.unit_price : Number(product.base_price) || 0;
			let variationName: string | null = null;
			let itemSku: string = product.sku || product.id;

			if (item.variation_id) {
				const variation = product.product_variations?.find((v: { id: string }) => v.id === item.variation_id);
				if (variation) {
					if (item.unit_price === undefined) {
						unitPrice = Number(variation.price) || unitPrice;
					}
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

		const shippingAmount = Number(data.shipping_amount || 0);
		const discountAmount = Number(data.discount_amount || 0);
		const totalAmount = subtotal + shippingAmount - discountAmount;
		const normalizedPhone = normalizeBDPhone(data.customer_phone);

		const shippingAddressObj = {
			name: data.customer_name,
			first_name: data.customer_name.split(" ")[0] || "",
			last_name: data.customer_name.split(" ").slice(1).join(" ") || "",
			phone: normalizedPhone,
			email: data.customer_email || "",
			address_line1: data.address_line1,
			address_line2: data.address_line2 || "",
			city: data.city || "Dhaka",
			state: data.state || "",
			postal_code: data.postal_code || "",
			country: data.country || "BD",
		};

		const orderNumber = `ORD-ADM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

		// Insert order
		const { data: order, error: orderError } = await adminSupabase
			.from("orders")
			.insert({
				order_number: orderNumber,
				status: data.status,
				payment_status: data.payment_status,
				payment_method: data.payment_method,
				subtotal,
				tax_amount: 0,
				shipping_amount: shippingAmount,
				discount_amount: discountAmount,
				total: totalAmount,
				currency: "BDT",
				shipping_method: data.shipping_method,
				shipping_address: shippingAddressObj,
				billing_address: shippingAddressObj,
				customer_notes: data.notes || null,
				source: "admin_panel",
			})
			.select()
			.single();

		if (orderError || !order) {
			console.error("Admin order creation failed:", orderError);
			return errorResponse("ORDER_CREATION_FAILED", orderError?.message || "Failed to create order", 500);
		}

		// Insert order items
		const itemsWithOrderId = orderItemsToInsert.map((item) => ({
			...item,
			order_id: order.id,
		}));

		await adminSupabase.from("order_items").insert(itemsWithOrderId);

		return successResponse(order, HTTP_STATUS.CREATED);
	} catch (error: any) {
		console.error("Admin create order POST error:", error);
		return errorResponse("INTERNAL_ERROR", error.message || "Internal server error", 500);
	}
}
