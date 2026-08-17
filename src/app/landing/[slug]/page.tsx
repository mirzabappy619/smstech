import { Metadata } from "next";
import { notFound } from "next/navigation";
import type {
	LandingPage,
	LandingPageBlock,
	BlockType,
} from "@/app/landing-page-types";
import HeroBlockRender from "@/app/landing-blocks/HeroBlockRender";
import VideoBlockRender from "@/app/landing-blocks/VideoBlockRender";
import FeaturesBlockRender from "@/app/landing-blocks/FeaturesBlockRender";
import PricingBlockRender from "@/app/landing-blocks/PricingBlockRender";
import WhyUsBlockRender from "@/app/landing-blocks/WhyUsBlockRender";
import ContactBlockRender from "@/app/landing-blocks/ContactBlockRender";
import OrderFormBlockRender from "@/app/landing-blocks/OrderFormBlockRender";
import { createServerClient } from "@/lib/supabase/server";

// Allow dynamic routes that aren't pre-generated at build time
export const dynamic = "force-dynamic";
export const dynamicParams = true;

interface PageProps {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ preview?: string }>;
}

async function fetchLandingPage(
	slug: string,
	isPreview: boolean,
): Promise<LandingPage | null> {
	try {
		const supabase = await createServerClient();

		let query = supabase
			.from("landing_pages")
			.select("*")
			.eq("slug", slug);

		if (!isPreview) {
			query = query.eq("status", "published");
		} else {
			// Preview requires admin auth
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return null;
			const { data: userData } = await supabase
				.from("users")
				.select("role")
				.eq("auth_id", user.id)
				.single();
			if (userData?.role !== "admin" && userData?.role !== "owner") return null;
		}

		const { data: landingPage, error: pageError } = await query.single();

		if (pageError || !landingPage) return null;

		const { data: blocks, error: blocksError } = await supabase
			.from("landing_page_blocks")
			.select("*")
			.eq("landing_page_id", landingPage.id)
			.eq("is_active", true)
			.order("sort_order", { ascending: true });

		if (blocksError) {
			console.error("Error fetching blocks:", blocksError);
			return null;
		}

		return {
			id: landingPage.id,
			title: landingPage.title,
			slug: landingPage.slug,
			metaTitle: landingPage.meta_title,
			metaDescription: landingPage.meta_description,
			metaKeywords: landingPage.meta_keywords,
			status: landingPage.status,
			blocks: (blocks || []).map((block: any) => ({
				id: block.id,
				blockType: block.block_type,
				blockData: block.block_data,
				sortOrder: block.sort_order,
				isActive: block.is_active,
			})),
		} as LandingPage;
	} catch (error) {
		console.error("Error fetching landing page:", error);
		return null;
	}
}

export async function generateMetadata({
	params,
	searchParams,
}: PageProps): Promise<Metadata> {
	const { slug } = await params;
	const { preview } = await searchParams;
	const isPreview = preview === "true";

	const landingPage = await fetchLandingPage(slug, isPreview);

	if (!landingPage) {
		return {
			title: "Page Not Found",
		};
	}

	return {
		title: landingPage.metaTitle || landingPage.title,
		description: landingPage.metaDescription || undefined,
		keywords: landingPage.metaKeywords?.join(", ") || undefined,
	};
}

function renderBlock(block: LandingPageBlock) {
	const { blockType, blockData, id } = block;

	switch (blockType as BlockType) {
		case "hero":
			return (
				<HeroBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "video":
			return (
				<VideoBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "features":
			return (
				<FeaturesBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "pricing":
			return (
				<PricingBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "why_us":
			return (
				<WhyUsBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "contact":
			return (
				<ContactBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		case "order_form":
			return (
				<OrderFormBlockRender
					key={id}
					data={blockData as any}
				/>
			);
		default:
			console.warn(`Unknown block type: ${blockType}`);
			return null;
	}
}

export default async function LandingPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const { preview } = await searchParams;
	const isPreview = preview === "true";

	const landingPage = await fetchLandingPage(slug, isPreview);

	if (!landingPage) {
		notFound();
	}

	const blocks = landingPage.blocks || [];

	console.log("Landing page blocks count:", blocks.length);
	console.log(
		"Block types:",
		blocks.map((b) => b.blockType),
	);

	return (
		<main className="min-h-screen">
			{isPreview && (
				<div className="bg-yellow-500 text-black px-4 py-2 text-center font-semibold">
					Preview Mode - This page is not published
				</div>
			)}
			{blocks.length === 0 ? (
				<div className="flex items-center justify-center min-h-screen">
					<div className="text-center">
						<h1 className="text-2xl font-bold mb-2">No Content Yet</h1>
						<p className="text-gray-600">
							This landing page doesn&apos;t have any blocks yet.
						</p>
					</div>
				</div>
			) : (
				<div className="landing-page-blocks">
					{blocks.map((block) => renderBlock(block))}
				</div>
			)}
		</main>
	);
}
