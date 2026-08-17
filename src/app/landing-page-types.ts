import { z } from "zod";

// ==============================================
// BLOCK TYPE DEFINITIONS
// ==============================================

export type BlockType =
	| "hero"
	| "video"
	| "features"
	| "pricing"
	| "why_us"
	| "contact"
	| "order_form";

export type LandingPageStatus = "draft" | "published";

// ==============================================
// HERO BLOCK
// ==============================================
export interface HeroBlockData {
	title: string;
	subtitle: string;
	ctaText: string;
	ctaLink: string;
	backgroundImage?: string;
	backgroundType?: "image" | "gradient" | "color";
	backgroundColor?: string;
	textColor?: "light" | "dark";
}

export const heroBlockSchema = z.object({
	title: z.string().min(1).max(200),
	subtitle: z.string().min(1).max(500),
	ctaText: z.string().min(1).max(50),
	ctaLink: z.string().min(1),
	backgroundImage: z.string().url().optional(),
	backgroundType: z.enum(["image", "gradient", "color"]).default("gradient"),
	backgroundColor: z.string().optional(),
	textColor: z.enum(["light", "dark"]).default("light"),
});

// ==============================================
// VIDEO BLOCK
// ==============================================
export interface VideoBlockData {
	youtubeUrl: string;
	title: string;
	description?: string;
	autoplay?: boolean;
	showControls?: boolean;
}

export const videoBlockSchema = z.object({
	youtubeUrl: z.string().url(),
	title: z.string().min(1).max(200),
	description: z.string().max(500).optional(),
	autoplay: z.boolean().default(false),
	showControls: z.boolean().default(true),
});

// ==============================================
// FEATURES BLOCK
// ==============================================
export interface FeatureItem {
	icon: string;
	title: string;
	description: string;
}

export interface FeaturesBlockData {
	title: string;
	subtitle?: string;
	features: FeatureItem[];
	columns?: number;
}

export const featureItemSchema = z.object({
	icon: z.string().min(1),
	title: z.string().min(1).max(100),
	description: z.string().min(1).max(300),
});

export const featuresBlockSchema = z.object({
	title: z.string().min(1).max(200),
	subtitle: z.string().max(500).optional(),
	features: z.array(featureItemSchema).min(1).max(12),
	columns: z.number().int().min(1).max(4).default(3),
});

// ==============================================
// PRICING BLOCK
// ==============================================
export interface PricingPlan {
	name: string;
	price: number;
	period: string;
	description?: string;
	features: string[];
	ctaText: string;
	ctaLink: string;
	highlighted?: boolean;
}

export interface PricingBlockData {
	title: string;
	subtitle?: string;
	plans: PricingPlan[];
	currency?: string;
}

export const pricingPlanSchema = z.object({
	name: z.string().min(1).max(100),
	price: z.number().min(0),
	period: z.string().min(1).max(50),
	description: z.string().max(300).optional(),
	features: z.array(z.string()).min(1),
	ctaText: z.string().min(1).max(50),
	ctaLink: z.string().min(1),
	highlighted: z.boolean().default(false),
});

export const pricingBlockSchema = z.object({
	title: z.string().min(1).max(200),
	subtitle: z.string().max(500).optional(),
	plans: z.array(pricingPlanSchema).min(1).max(6),
	currency: z.string().default("USD"),
});

// ==============================================
// WHY US BLOCK
// ==============================================
export interface WhyUsItem {
	icon: string;
	title: string;
	description: string;
}

export interface WhyUsBlockData {
	title: string;
	subtitle?: string;
	reasons: WhyUsItem[];
}

export const whyUsItemSchema = z.object({
	icon: z.string().min(1),
	title: z.string().min(1).max(100),
	description: z.string().min(1).max(300),
});

export const whyUsBlockSchema = z.object({
	title: z.string().min(1).max(200),
	subtitle: z.string().max(500).optional(),
	reasons: z.array(whyUsItemSchema).min(1).max(8),
});

// ==============================================
// CONTACT BLOCK
// ==============================================
export interface ContactBlockData {
	title: string;
	phoneNumber: string;
	description?: string;
	email?: string;
	showForm?: boolean;
}

export const contactBlockSchema = z.object({
	title: z.string().min(1).max(200),
	phoneNumber: z.string().min(1),
	description: z.string().max(500).optional(),
	email: z.string().email().optional(),
	showForm: z.boolean().default(false),
});

// ==============================================
// ORDER FORM BLOCK
// ==============================================
export interface ProductOption {
	id: string;
	name: string;
	price: number;
	description?: string;
	image?: string;
}

export interface OrderFormBlockData {
	title: string;
	subtitle?: string;
	productOptions: ProductOption[];
	showQuantity?: boolean;
	requiredFields?: string[];
	successMessage?: string;
}

export const productOptionSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(200),
	price: z.number().min(0),
	description: z.string().max(300).optional(),
	image: z.string().url().optional(),
});

export const orderFormBlockSchema = z.object({
	title: z.string().min(1).max(200),
	subtitle: z.string().max(500).optional(),
	productOptions: z.array(productOptionSchema).min(1),
	showQuantity: z.boolean().default(true),
	requiredFields: z
		.array(z.enum(["firstName", "lastName", "email", "phone", "address"]))
		.default(["firstName", "lastName", "phone", "address"]),
	successMessage: z.string().max(500).optional(),
});

// ==============================================
// BLOCK DATA UNION TYPE
// ==============================================
export type BlockData =
	| HeroBlockData
	| VideoBlockData
	| FeaturesBlockData
	| PricingBlockData
	| WhyUsBlockData
	| ContactBlockData
	| OrderFormBlockData;

// ==============================================
// LANDING PAGE BLOCK
// ==============================================
export interface LandingPageBlock {
	id: string;
	landingPageId: string;
	blockType: BlockType;
	blockData: BlockData;
	sortOrder: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

// ==============================================
// LANDING PAGE
// ==============================================
export interface LandingPage {
	id: string;
	title: string;
	slug: string;
	metaTitle?: string;
	metaDescription?: string;
	metaKeywords?: string[];
	status: LandingPageStatus;
	publishedAt?: string;
	viewCount: number;
	conversionCount: number;
	createdBy?: string;
	updatedBy?: string;
	createdAt: string;
	updatedAt: string;
	blocks?: LandingPageBlock[];
}

// ==============================================
// API SCHEMAS
// ==============================================

// Block input schema for create/update
const blockInputSchema = z.object({
	blockType: z.enum([
		"hero",
		"video",
		"features",
		"pricing",
		"why_us",
		"contact",
		"order_form",
	]),
	blockData: z.record(z.any()), // JSONB data
	sortOrder: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
});

export const createLandingPageSchema = z.object({
	title: z.string().min(1).max(255),
	slug: z
		.string()
		.min(1)
		.max(255)
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		),
	metaTitle: z.string().max(70).optional(),
	metaDescription: z.string().max(160).optional(),
	metaKeywords: z.array(z.string()).optional(),
	blocks: z.array(blockInputSchema).optional().default([]),
});

export const updateLandingPageSchema = z.object({
	title: z.string().min(1).max(255).optional(),
	slug: z
		.string()
		.min(1)
		.max(255)
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must contain only lowercase letters, numbers, and hyphens",
		)
		.optional(),
	metaTitle: z.string().max(70).optional(),
	metaDescription: z.string().max(160).optional(),
	metaKeywords: z.array(z.string()).optional(),
	blocks: z.array(blockInputSchema).optional(),
});

export const createBlockSchema = z.object({
	blockType: z.enum([
		"hero",
		"video",
		"features",
		"pricing",
		"why_us",
		"contact",
		"order_form",
	]),
	blockData: z.record(z.any()),
	sortOrder: z.number().int().min(0),
});

export const updateBlocksSchema = z.object({
	blocks: z.array(
		z.object({
			id: z.string().uuid().optional(),
			blockType: z.enum([
				"hero",
				"video",
				"features",
				"pricing",
				"why_us",
				"contact",
				"order_form",
			]),
			blockData: z.record(z.any()),
			sortOrder: z.number().int().min(0),
			isActive: z.boolean().default(true),
		}),
	),
});

// Helper function to validate block data based on type
export function validateBlockData(
	blockType: BlockType,
	blockData: unknown,
): { success: boolean; data?: BlockData; error?: string } {
	try {
		let schema;
		switch (blockType) {
			case "hero":
				schema = heroBlockSchema;
				break;
			case "video":
				schema = videoBlockSchema;
				break;
			case "features":
				schema = featuresBlockSchema;
				break;
			case "pricing":
				schema = pricingBlockSchema;
				break;
			case "why_us":
				schema = whyUsBlockSchema;
				break;
			case "contact":
				schema = contactBlockSchema;
				break;
			case "order_form":
				schema = orderFormBlockSchema;
				break;
			default:
				return { success: false, error: "Invalid block type" };
		}

		const result = schema.safeParse(blockData);
		if (result.success) {
			return { success: true, data: result.data as BlockData };
		} else {
			return {
				success: false,
				error: result.error.errors.map((e) => e.message).join(", "),
			};
		}
	} catch {
		return { success: false, error: "Validation error" };
	}
}
