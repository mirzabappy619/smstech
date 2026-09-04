// Validation Schemas - Shared validation schemas using Zod

import { z } from 'zod';

// ==============================================
// COMMON SCHEMAS
// ==============================================
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional();
export const uuidSchema = z.string().uuid('Invalid ID format');
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');
export const urlSchema = z.string().url('Invalid URL');
export const moneySchema = z.number().min(0, 'Amount must be non-negative');

// ==============================================
// ADDRESS SCHEMA
// ==============================================
export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(200),
  apartment: z.string().max(50).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100),
});

export type AddressInput = z.infer<typeof addressSchema>;

// ==============================================
// USER SCHEMAS
// ==============================================
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: phoneSchema,
  avatarUrl: urlSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ==============================================
// PRODUCT SCHEMAS
// ==============================================
export const productVariationSchema = z.object({
  name: z.string().min(1).max(100),
  sku: z.string().min(1).max(50),
  price: moneySchema.positive('Price must be greater than 0'),
  compareAtPrice: moneySchema.optional(),
  stock: z.number().int().min(0).default(0),
  attributes: z.record(z.string()).default({}),
  images: z.array(urlSchema).default([]),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema.max(200),
  description: z.string().min(1),
  shortDescription: z.string().max(500).optional(),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  categoryId: uuidSchema,
  brandId: uuidSchema.optional(),
  basePrice: moneySchema.positive(),
  compareAtPrice: moneySchema.optional(),
  currency: z.string().length(3).default('BDT'),
  images: z.array(urlSchema).default([]),
  tags: z.array(z.string().max(50)).default([]),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  variations: z.array(productVariationSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Alias for createProductSchema
export const productSchema = createProductSchema;

export const productFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  search: z.string().optional(),
  featured: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  tags: z.string().optional(), // comma-separated
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;

// ==============================================
// CATEGORY SCHEMAS
// ==============================================
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema.max(100),
  description: z.string().max(500).optional(),
  parentId: uuidSchema.optional(),
  image: urlSchema.optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ==============================================
// ORDER SCHEMAS
// ==============================================
export const orderItemSchema = z.object({
  productId: uuidSchema,
  variationId: uuidSchema.optional(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethod: z.string().min(1),
  couponCode: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
    'partially_refunded',
  ]),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

export const orderFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: uuidSchema.optional(),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

// ==============================================
// CART SCHEMAS
// ==============================================
export const addToCartSchema = z.object({
  productId: uuidSchema,
  variationId: uuidSchema.optional(),
  quantity: z.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

// ==============================================
// INVENTORY SCHEMAS
// ==============================================
export const adjustInventorySchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(1).max(500),
  orderId: uuidSchema.optional(),
});

export const inventoryFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  locationId: uuidSchema.optional(),
  lowStock: z.coerce.boolean().optional(),
  outOfStock: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
export type InventoryFilters = z.infer<typeof inventoryFiltersSchema>;

// ==============================================
// COUPON SCHEMAS
// ==============================================
export const createCouponSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().positive(),
  minOrderAmount: moneySchema.optional(),
  maxUses: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export const updateCouponSchema = createCouponSchema.partial();

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

// ==============================================
// DELIVERY SCHEMAS
// ==============================================
export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  postalCodes: z.array(z.string()).default([]),
  shippingRate: moneySchema,
  minOrderForFree: moneySchema.optional(),
  estimatedDays: z.number().int().positive().default(3),
  isActive: z.boolean().default(true),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial();

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;

// ==============================================
// NOTIFICATION SCHEMAS
// ==============================================
export const sendNotificationSchema = z.object({
  userId: uuidSchema,
  type: z.enum(['email', 'sms', 'push', 'in_app']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

// ==============================================
// ADMIN SCHEMAS
// ==============================================
export const createAdminUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['admin', 'owner', 'delivery']),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['customer', 'admin', 'owner', 'delivery']),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

// ==============================================
// ANALYTICS SCHEMAS
// ==============================================
export const analyticsFiltersSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;

// ==============================================
// WEBHOOK SCHEMAS
// ==============================================
export const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  signature: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
