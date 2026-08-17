"use client";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	BlockType,
	LandingPage,
	HeroBlockData,
	VideoBlockData,
	FeaturesBlockData,
	PricingBlockData,
	WhyUsBlockData,
	ContactBlockData,
	OrderFormBlockData,
	BlockData,
	FeatureItem,
	PricingPlan,
	WhyUsItem,
	ProductOption,
} from "@/app/landing-page-types";
import { createClient } from "@/lib/supabase/client";

interface PageProps {
	params: Promise<{ params?: string[] }>;
}

interface BlockInstance {
	id: string;
	blockType: BlockType;
	blockData: BlockData;
	sortOrder: number;
	isActive: boolean;
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
	{ type: "hero", label: "Hero Section", icon: "🎯" },
	{ type: "video", label: "Video Section", icon: "📹" },
	{ type: "features", label: "Features Grid", icon: "⭐" },
	{ type: "pricing", label: "Pricing Table", icon: "💰" },
	{ type: "why_us", label: "Why Choose Us", icon: "✨" },
	{ type: "contact", label: "Contact Info", icon: "📞" },
	{ type: "order_form", label: "Order Form", icon: "📝" },
];

function LandingPageBuilder({ params }: PageProps) {
	// Resolve the params promise (not currently used but required by Next.js API)
	use(params);
	const router = useRouter();
	const searchParams = useSearchParams();
	const pageId = searchParams.get("id");

	const [page, setPage] = useState<Partial<LandingPage>>({
		title: "",
		slug: "",
		metaTitle: "",
		metaDescription: "",
		metaKeywords: [],
		status: "draft",
	});

	const [blocks, setBlocks] = useState<BlockInstance[]>([]);
	const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
		null,
	);
	const [draggedBlockType, setDraggedBlockType] = useState<BlockType | null>(
		null,
	);
	const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [slugError, setSlugError] = useState("");
	const [slugChecking, setSlugChecking] = useState(false);
	const [showPageSettings, setShowPageSettings] = useState(false);
	const [toast, setToast] = useState<{
		message: string;
		type: "success" | "error";
	} | null>(null);

	useEffect(() => {
		if (pageId) {
			loadPage();
		}
	}, [pageId]);

	const loadPage = async () => {
		setLoading(true);
		try {
			// include auth token from client session so server can verify
			const supabase = createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.access_token;

			const headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const res = await fetch(`/api/v1/admin/landing-pages/${pageId}`, {
				headers,
			});
			if (res.ok) {
				const response = await res.json();

				// Check if response has the expected structure
				if (response.success && response.data) {
					const pageData = response.data;
					setPage({
						title: pageData.title,
						slug: pageData.slug,
						metaTitle: pageData.metaTitle,
						metaDescription: pageData.metaDescription,
						metaKeywords: pageData.metaKeywords || [],
						status: pageData.status,
					});

					if (pageData.blocks) {
						setBlocks(
							pageData.blocks
								.sort((a: any, b: any) => a.sortOrder - b.sortOrder)
								.map((block: any) => ({
									id: block.id,
									blockType: block.blockType,
									blockData: block.blockData,
									sortOrder: block.sortOrder,
									isActive: block.isActive,
								})),
						);
					}
				} else {
					showToast("Failed to load page data", "error");
				}
			} else {
				showToast("Failed to load page", "error");
			}
		} catch (error) {
			showToast("Error loading page", "error");
		} finally {
			setLoading(false);
		}
	};

	const checkSlug = useCallback(
		async (slug: string) => {
			if (!slug || slug === page.slug) return;

			setSlugChecking(true);
			setSlugError("");

			try {
				const supabase = createClient();
				const {
					data: { session },
				} = await supabase.auth.getSession();
				const token = session?.access_token;

				const headers: Record<string, string> = {};
				if (token) {
					headers.Authorization = `Bearer ${token}`;
				}

				const res = await fetch(
					`/api/v1/admin/landing-pages/check-slug?slug=${slug}`,
					{
						headers,
					},
				);
				const data = await res.json();

				if (!data.available) {
					setSlugError("This slug is already taken");
				}
			} catch (error) {
				setSlugError("Error checking slug");
			} finally {
				setSlugChecking(false);
			}
		},
		[page.slug],
	);

	useEffect(() => {
		const timer = setTimeout(() => {
			if (page.slug) {
				checkSlug(page.slug);
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [page.slug, checkSlug]);

	const showToast = (message: string, type: "success" | "error") => {
		setToast({ message, type });
		setTimeout(() => setToast(null), 3000);
	};

	const createDefaultBlockData = (blockType: BlockType): BlockData => {
		switch (blockType) {
			case "hero":
				return {
					title: "Welcome to Our Site",
					subtitle: "Discover amazing products and services",
					ctaText: "Get Started",
					ctaLink: "#",
					backgroundType: "gradient",
					textColor: "light",
				} as HeroBlockData;

			case "video":
				return {
					youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
					title: "Watch Our Video",
					description: "Learn more about what we do",
					autoplay: false,
					showControls: true,
				} as VideoBlockData;

			case "features":
				return {
					title: "Our Features",
					subtitle: "What makes us special",
					features: [
						{
							icon: "⚡",
							title: "Fast",
							description: "Lightning fast performance",
						},
						{
							icon: "🔒",
							title: "Secure",
							description: "Your data is safe with us",
						},
						{
							icon: "💎",
							title: "Quality",
							description: "Premium quality products",
						},
					],
					columns: 3,
				} as FeaturesBlockData;

			case "pricing":
				return {
					title: "Our Pricing",
					subtitle: "Choose the plan that fits your needs",
					plans: [
						{
							name: "Basic",
							price: 9.99,
							period: "month",
							description: "Perfect for getting started",
							features: ["Feature 1", "Feature 2", "Feature 3"],
							ctaText: "Get Started",
							ctaLink: "#",
							highlighted: false,
						},
					],
					currency: "USD",
				} as PricingBlockData;

			case "why_us":
				return {
					title: "Why Choose Us",
					subtitle: "Here's what sets us apart",
					reasons: [
						{
							icon: "🎯",
							title: "Expert Team",
							description: "Years of experience",
						},
						{
							icon: "🚀",
							title: "Fast Delivery",
							description: "Quick turnaround times",
						},
						{
							icon: "💯",
							title: "Quality Guarantee",
							description: "100% satisfaction",
						},
					],
				} as WhyUsBlockData;

			case "contact":
				return {
					title: "Contact Us",
					phoneNumber: "+1 (555) 123-4567",
					description: "Get in touch with our team",
					email: "contact@example.com",
					showForm: false,
				} as ContactBlockData;

			case "order_form":
				return {
					title: "Place Your Order",
					subtitle: "Fill out the form below",
					productOptions: [],
					showQuantity: true,
					requiredFields: ["firstName", "lastName", "phone", "address"],
				} as OrderFormBlockData;

			default:
				throw new Error("Unknown block type");
		}
	};

	const handleDragStartPalette = (blockType: BlockType) => {
		setDraggedBlockType(blockType);
	};

	const handleDragStartCanvas = (index: number) => {
		setDraggedBlockIndex(index);
	};

	const handleDragOverCanvas = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDropOnCanvas = (e: React.DragEvent, dropIndex?: number) => {
		e.preventDefault();

		if (draggedBlockType) {
			const newBlock: BlockInstance = {
				id: `temp-${Date.now()}`,
				blockType: draggedBlockType,
				blockData: createDefaultBlockData(draggedBlockType),
				sortOrder: dropIndex ?? blocks.length,
				isActive: true,
			};

			const newBlocks = [...blocks];
			if (dropIndex !== undefined) {
				newBlocks.splice(dropIndex, 0, newBlock);
			} else {
				newBlocks.push(newBlock);
			}

			setBlocks(newBlocks.map((b, i) => ({ ...b, sortOrder: i })));
			setDraggedBlockType(null);
		} else if (draggedBlockIndex !== null) {
			const newBlocks = [...blocks];
			const [movedBlock] = newBlocks.splice(draggedBlockIndex, 1);
			const targetIndex = dropIndex ?? blocks.length - 1;
			newBlocks.splice(targetIndex, 0, movedBlock);

			setBlocks(newBlocks.map((b, i) => ({ ...b, sortOrder: i })));
			setDraggedBlockIndex(null);
		}
	};

	const handleDeleteBlock = (index: number) => {
		const newBlocks = blocks.filter((_, i) => i !== index);
		setBlocks(newBlocks.map((b, i) => ({ ...b, sortOrder: i })));
		if (selectedBlockIndex === index) {
			setSelectedBlockIndex(null);
		}
	};

	const handleUpdateBlockData = (index: number, data: BlockData) => {
		const newBlocks = [...blocks];
		newBlocks[index].blockData = data;
		setBlocks(newBlocks);
	};

	const handleSave = async (publish = false) => {
		setSaving(true);
		try {
			const payload = {
				title: page.title,
				slug: page.slug,
				metaTitle: page.metaTitle,
				metaDescription: page.metaDescription,
				metaKeywords: page.metaKeywords,
				blocks: blocks.map((block) => ({
					id: block.id.startsWith("temp-") ? undefined : block.id,
					blockType: block.blockType,
					blockData: block.blockData,
					sortOrder: block.sortOrder,
					isActive: block.isActive,
				})),
			};

			const supabase = createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const token = session?.access_token;

			let res;
			if (pageId) {
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
				};
				if (token) {
					headers.Authorization = `Bearer ${token}`;
				}

				res = await fetch(`/api/v1/admin/landing-pages/${pageId}`, {
					method: "PUT",
					headers,
					body: JSON.stringify(payload),
				});
			} else {
				const headers: Record<string, string> = {
					"Content-Type": "application/json",
				};
				if (token) {
					headers.Authorization = `Bearer ${token}`;
				}

				res = await fetch("/api/v1/admin/landing-pages", {
					method: "POST",
					headers,
					body: JSON.stringify(payload),
				});
			}

			if (res.ok) {
				const response = await res.json();

				// Check if the response indicates success
				if (!response.success) {
					showToast(response.error?.message || "Failed to save page", "error");
					return;
				}

				const savedPage = response.data;

				if (publish) {
					const publishHeaders: Record<string, string> = {
						"Content-Type": "application/json",
					};
					if (token) {
						publishHeaders.Authorization = `Bearer ${token}`;
					}

					const publishRes = await fetch(
						`/api/v1/admin/landing-pages/${savedPage.id}/publish`,
						{
							method: "POST",
							headers: publishHeaders,
						},
					);

					if (publishRes.ok) {
						const publishResponse = await publishRes.json();
						if (publishResponse.success) {
							showToast("Page published successfully!", "success");
							router.push("/admin/landing-pages");
						} else {
							showToast(
								publishResponse.error?.message || "Failed to publish",
								"error",
							);
						}
					} else {
						showToast("Saved but failed to publish", "error");
					}
				} else {
					showToast("Page saved successfully!", "success");
					if (!pageId) {
						router.push(`/admin/landing-pages/builder/${savedPage.id}`);
					}
				}
			} else {
				const errorData = await res.json();
				console.error("Save page error:", errorData);
				showToast(errorData.error?.message || "Failed to save page", "error");
			}
		} catch (error) {
			console.error("Exception saving page:", error);
			showToast("Error saving page", "error");
		} finally {
			setSaving(false);
		}
	};

	const handlePreview = () => {
		if (page.slug) {
			window.open(`/landing/${page.slug}`, "_blank");
		} else {
			showToast("Please save the page first", "error");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-lg">Loading...</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950">
			{/* Left Sidebar - Block Palette */}
			<div className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 overflow-y-auto">
				<div className="p-4 border-b border-gray-200 dark:border-zinc-800">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
						Block Palette
					</h2>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
						Drag blocks to canvas
					</p>
				</div>

				<div className="p-4 space-y-2">
					{BLOCK_TYPES.map((blockType) => (
						<div
							key={blockType.type}
							draggable
							onDragStart={() => handleDragStartPalette(blockType.type)}
							className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg cursor-move hover:bg-gray-100 dark:hover:bg-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors">
							<span className="text-2xl">{blockType.icon}</span>
							<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
								{blockType.label}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Center Canvas */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Top Bar */}
				<div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 p-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={() => router.push("/admin/landing-pages")}
							className="text-gray-600 hover:text-zinc-900 dark:hover:text-zinc-100">
							← Back
						</button>
						<div>
							<h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
								{pageId ? "Edit Landing Page" : "New Landing Page"}
							</h1>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								{page.status === "published" ? "Published" : "Draft"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setShowPageSettings(!showPageSettings)}
							className="px-4 py-2 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
							⚙️ Settings
						</button>
						<button
							onClick={handlePreview}
							disabled={!page.slug}
							className="px-4 py-2 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed">
							👁️ Preview
						</button>
						<button
							onClick={() => handleSave(false)}
							disabled={saving}
							className="px-4 py-2 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-50">
							{saving ? "Saving..." : "💾 Save Draft"}
						</button>
						<button
							onClick={() => handleSave(true)}
							disabled={saving || page.status === "published"}
							className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
							{saving ? "Publishing..." : "🚀 Publish"}
						</button>
					</div>
				</div>

				{/* Page Settings Modal */}
				{showPageSettings && (
					<div className="bg-yellow-50 border-b border-yellow-200 p-4">
						<div className="max-w-3xl mx-auto space-y-4">
							<h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
								Page Settings
							</h3>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Page Title *
									</label>
									<input
										type="text"
										value={page.title || ""}
										onChange={(e) =>
											setPage({ ...page, title: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="My Awesome Landing Page"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										URL Slug *
									</label>
									<input
										type="text"
										value={page.slug || ""}
										onChange={(e) =>
											setPage({ ...page, slug: e.target.value.toLowerCase() })
										}
										className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 ${
											slugError
												? "border-red-500"
												: "border-gray-300 dark:border-zinc-600"
										}`}
										placeholder="my-awesome-page"
									/>
									{slugChecking && (
										<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
											Checking availability...
										</p>
									)}
									{slugError && (
										<p className="text-xs text-red-600 mt-1">{slugError}</p>
									)}
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Meta Title
									</label>
									<input
										type="text"
										value={page.metaTitle || ""}
										onChange={(e) =>
											setPage({ ...page, metaTitle: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="SEO title (max 70 chars)"
										maxLength={70}
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Meta Description
									</label>
									<input
										type="text"
										value={page.metaDescription || ""}
										onChange={(e) =>
											setPage({ ...page, metaDescription: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										placeholder="SEO description (max 160 chars)"
										maxLength={160}
									/>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
									Meta Keywords (comma-separated)
								</label>
								<input
									type="text"
									value={page.metaKeywords?.join(", ") || ""}
									onChange={(e) =>
										setPage({
											...page,
											metaKeywords: e.target.value
												.split(",")
												.map((k) => k.trim()),
										})
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="landing page, product, service"
								/>
							</div>

							<button
								onClick={() => setShowPageSettings(false)}
								className="text-sm text-blue-600 hover:text-blue-700">
								Close Settings
							</button>
						</div>
					</div>
				)}

				{/* Canvas Area */}
				<div
					className="flex-1 overflow-y-auto p-8"
					onDragOver={handleDragOverCanvas}
					onDrop={(e) => handleDropOnCanvas(e)}>
					<div className="max-w-5xl mx-auto space-y-4">
						{blocks.length === 0 ? (
							<div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
								<p className="text-zinc-500 dark:text-zinc-400 text-lg">
									Drag blocks from the left palette to start building
								</p>
							</div>
						) : (
							blocks.map((block, index) => (
								<div
									key={block.id}
									draggable
									onDragStart={() => handleDragStartCanvas(index)}
									onDragOver={handleDragOverCanvas}
									onDrop={(e) => handleDropOnCanvas(e, index)}
									onClick={() => setSelectedBlockIndex(index)}
									className={`relative group border-2 rounded-lg p-6 cursor-pointer transition-all ${
										selectedBlockIndex === index
											? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
											: "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600"
									}`}>
									<div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteBlock(index);
											}}
											className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
											🗑️ Delete
										</button>
									</div>

									<div className="flex items-center gap-3 mb-2">
										<span className="text-2xl">
											{
												BLOCK_TYPES.find((bt) => bt.type === block.blockType)
													?.icon
											}
										</span>
										<span className="font-semibold text-zinc-900 dark:text-zinc-100">
											{
												BLOCK_TYPES.find((bt) => bt.type === block.blockType)
													?.label
											}
										</span>
									</div>

									<div className="text-sm text-gray-600">
										<BlockPreview
											blockType={block.blockType}
											blockData={block.blockData}
										/>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			{/* Right Sidebar - Block Configuration */}
			<div className="w-96 bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 overflow-y-auto">
				<div className="p-4 border-b border-gray-200 dark:border-zinc-800">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
						Block Settings
					</h2>
				</div>

				{selectedBlockIndex !== null && blocks[selectedBlockIndex] ? (
					<div className="p-4">
						<BlockConfigForm
							blockType={blocks[selectedBlockIndex].blockType}
							blockData={blocks[selectedBlockIndex].blockData}
							onUpdate={(data) =>
								handleUpdateBlockData(selectedBlockIndex, data)
							}
						/>
					</div>
				) : (
					<div className="p-4 text-center text-zinc-500 dark:text-zinc-400">
						<p>Select a block to edit its settings</p>
					</div>
				)}
			</div>

			{/* Toast Notification */}
			{toast && (
				<div className="fixed bottom-4 right-4 z-50">
					<div
						className={`px-6 py-3 rounded-lg shadow-lg ${
							toast.type === "success"
								? "bg-green-600 text-white"
								: "bg-red-600 text-white"
						}`}>
						{toast.message}
					</div>
				</div>
			)}
		</div>
	);
}

function BlockPreview({
	blockType,
	blockData,
}: {
	blockType: BlockType;
	blockData: BlockData;
}) {
	switch (blockType) {
		case "hero":
			const hero = blockData as HeroBlockData;
			return <div className="font-medium">{hero.title}</div>;
		case "video":
			const video = blockData as VideoBlockData;
			return <div>{video.title}</div>;
		case "features":
			const features = blockData as FeaturesBlockData;
			return (
				<div>
					{features.title} ({features.features.length} features)
				</div>
			);
		case "pricing":
			const pricing = blockData as PricingBlockData;
			return (
				<div>
					{pricing.title} ({pricing.plans.length} plans)
				</div>
			);
		case "why_us":
			const whyUs = blockData as WhyUsBlockData;
			return (
				<div>
					{whyUs.title} ({whyUs.reasons.length} reasons)
				</div>
			);
		case "contact":
			const contact = blockData as ContactBlockData;
			return <div>{contact.title}</div>;
		case "order_form":
			const orderForm = blockData as OrderFormBlockData;
			return <div>{orderForm.title}</div>;
		default:
			return <div>Unknown block</div>;
	}
}

function BlockConfigForm({
	blockType,
	blockData,
	onUpdate,
}: {
	blockType: BlockType;
	blockData: BlockData;
	onUpdate: (data: BlockData) => void;
}) {
	switch (blockType) {
		case "hero":
			return (
				<HeroBlockConfig
					data={blockData as HeroBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "video":
			return (
				<VideoBlockConfig
					data={blockData as VideoBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "features":
			return (
				<FeaturesBlockConfig
					data={blockData as FeaturesBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "pricing":
			return (
				<PricingBlockConfig
					data={blockData as PricingBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "why_us":
			return (
				<WhyUsBlockConfig
					data={blockData as WhyUsBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "contact":
			return (
				<ContactBlockConfig
					data={blockData as ContactBlockData}
					onUpdate={onUpdate}
				/>
			);
		case "order_form":
			return (
				<OrderFormBlockConfig
					data={blockData as OrderFormBlockData}
					onUpdate={onUpdate}
				/>
			);
		default:
			return <div>Unknown block type</div>;
	}
}

function HeroBlockConfig({
	data,
	onUpdate,
}: {
	data: HeroBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Subtitle
				</label>
				<textarea
					value={data.subtitle}
					onChange={(e) => onUpdate({ ...data, subtitle: e.target.value })}
					rows={3}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					CTA Text
				</label>
				<input
					type="text"
					value={data.ctaText}
					onChange={(e) => onUpdate({ ...data, ctaText: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					CTA Link
				</label>
				<input
					type="text"
					value={data.ctaLink}
					onChange={(e) => onUpdate({ ...data, ctaLink: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Background Type
				</label>
				<select
					value={data.backgroundType || "gradient"}
					onChange={(e) =>
						onUpdate({
							...data,
							backgroundType: e.target.value as "image" | "gradient" | "color",
						})
					}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg">
					<option value="gradient">Gradient</option>
					<option value="color">Solid Color</option>
					<option value="image">Image</option>
				</select>
			</div>

			{data.backgroundType === "image" && (
				<div>
					<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
						Background Image URL
					</label>
					<input
						type="text"
						value={data.backgroundImage || ""}
						onChange={(e) =>
							onUpdate({ ...data, backgroundImage: e.target.value })
						}
						className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
					/>
				</div>
			)}

			{data.backgroundType === "color" && (
				<div>
					<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
						Background Color
					</label>
					<input
						type="color"
						value={data.backgroundColor || "#000000"}
						onChange={(e) =>
							onUpdate({ ...data, backgroundColor: e.target.value })
						}
						className="w-full h-10 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
					/>
				</div>
			)}

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Text Color
				</label>
				<select
					value={data.textColor || "light"}
					onChange={(e) =>
						onUpdate({ ...data, textColor: e.target.value as "light" | "dark" })
					}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg">
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</div>
		</div>
	);
}

function VideoBlockConfig({
	data,
	onUpdate,
}: {
	data: VideoBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					YouTube URL
				</label>
				<input
					type="text"
					value={data.youtubeUrl}
					onChange={(e) => onUpdate({ ...data, youtubeUrl: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
					placeholder="https://www.youtube.com/watch?v=..."
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Description
				</label>
				<textarea
					value={data.description || ""}
					onChange={(e) => onUpdate({ ...data, description: e.target.value })}
					rows={3}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={data.autoplay || false}
					onChange={(e) => onUpdate({ ...data, autoplay: e.target.checked })}
					className="w-4 h-4"
				/>
				<label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
					Autoplay
				</label>
			</div>

			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={data.showControls !== false}
					onChange={(e) =>
						onUpdate({ ...data, showControls: e.target.checked })
					}
					className="w-4 h-4"
				/>
				<label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
					Show Controls
				</label>
			</div>
		</div>
	);
}

function FeaturesBlockConfig({
	data,
	onUpdate,
}: {
	data: FeaturesBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	const addFeature = () => {
		onUpdate({
			...data,
			features: [
				...data.features,
				{
					icon: "⭐",
					title: "New Feature",
					description: "Feature description",
				},
			],
		});
	};

	const removeFeature = (index: number) => {
		onUpdate({
			...data,
			features: data.features.filter((_, i) => i !== index),
		});
	};

	const updateFeature = (index: number, feature: FeatureItem) => {
		const newFeatures = [...data.features];
		newFeatures[index] = feature;
		onUpdate({ ...data, features: newFeatures });
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Section Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Subtitle
				</label>
				<input
					type="text"
					value={data.subtitle || ""}
					onChange={(e) => onUpdate({ ...data, subtitle: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Columns
				</label>
				<select
					value={data.columns || 3}
					onChange={(e) =>
						onUpdate({ ...data, columns: parseInt(e.target.value) })
					}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg">
					<option value={1}>1</option>
					<option value={2}>2</option>
					<option value={3}>3</option>
					<option value={4}>4</option>
				</select>
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
						Features
					</label>
					<button
						onClick={addFeature}
						className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
						+ Add
					</button>
				</div>

				<div className="space-y-3">
					{data.features.map((feature, index) => (
						<div
							key={index}
							className="p-3 border border-gray-200 dark:border-zinc-700 rounded-lg space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
									Feature {index + 1}
								</span>
								<button
									onClick={() => removeFeature(index)}
									className="text-red-600 hover:text-red-700 text-sm">
									Remove
								</button>
							</div>

							<input
								type="text"
								value={feature.icon}
								onChange={(e) =>
									updateFeature(index, { ...feature, icon: e.target.value })
								}
								placeholder="Icon (emoji)"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<input
								type="text"
								value={feature.title}
								onChange={(e) =>
									updateFeature(index, { ...feature, title: e.target.value })
								}
								placeholder="Title"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<textarea
								value={feature.description}
								onChange={(e) =>
									updateFeature(index, {
										...feature,
										description: e.target.value,
									})
								}
								placeholder="Description"
								rows={2}
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function PricingBlockConfig({
	data,
	onUpdate,
}: {
	data: PricingBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	const addPlan = () => {
		onUpdate({
			...data,
			plans: [
				...data.plans,
				{
					name: "New Plan",
					price: 0,
					period: "month",
					features: ["Feature 1"],
					ctaText: "Get Started",
					ctaLink: "#",
					highlighted: false,
				},
			],
		});
	};

	const removePlan = (index: number) => {
		onUpdate({
			...data,
			plans: data.plans.filter((_, i) => i !== index),
		});
	};

	const updatePlan = (index: number, plan: PricingPlan) => {
		const newPlans = [...data.plans];
		newPlans[index] = plan;
		onUpdate({ ...data, plans: newPlans });
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Section Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Subtitle
				</label>
				<input
					type="text"
					value={data.subtitle || ""}
					onChange={(e) => onUpdate({ ...data, subtitle: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Currency
				</label>
				<input
					type="text"
					value={data.currency || "USD"}
					onChange={(e) => onUpdate({ ...data, currency: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
						Plans
					</label>
					<button
						onClick={addPlan}
						className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
						+ Add
					</button>
				</div>

				<div className="space-y-3">
					{data.plans.map((plan, index) => (
						<div
							key={index}
							className="p-3 border border-gray-200 dark:border-zinc-700 rounded-lg space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
									Plan {index + 1}
								</span>
								<button
									onClick={() => removePlan(index)}
									className="text-red-600 hover:text-red-700 text-sm">
									Remove
								</button>
							</div>

							<input
								type="text"
								value={plan.name}
								onChange={(e) =>
									updatePlan(index, { ...plan, name: e.target.value })
								}
								placeholder="Plan Name"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<div className="grid grid-cols-2 gap-2">
								<input
									type="number"
									value={plan.price}
									onChange={(e) =>
										updatePlan(index, {
											...plan,
											price: parseFloat(e.target.value),
										})
									}
									placeholder="Price"
									className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
								/>

								<input
									type="text"
									value={plan.period}
									onChange={(e) =>
										updatePlan(index, { ...plan, period: e.target.value })
									}
									placeholder="Period"
									className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
								/>
							</div>

							<textarea
								value={plan.features.join("\n")}
								onChange={(e) =>
									updatePlan(index, {
										...plan,
										features: e.target.value.split("\n"),
									})
								}
								placeholder="Features (one per line)"
								rows={3}
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<input
								type="text"
								value={plan.ctaText}
								onChange={(e) =>
									updatePlan(index, { ...plan, ctaText: e.target.value })
								}
								placeholder="CTA Text"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<input
								type="text"
								value={plan.ctaLink}
								onChange={(e) =>
									updatePlan(index, { ...plan, ctaLink: e.target.value })
								}
								placeholder="CTA Link"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={plan.highlighted || false}
									onChange={(e) =>
										updatePlan(index, {
											...plan,
											highlighted: e.target.checked,
										})
									}
									className="w-4 h-4"
								/>
								<label className="text-sm text-zinc-900 dark:text-zinc-100">
									Highlighted
								</label>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function WhyUsBlockConfig({
	data,
	onUpdate,
}: {
	data: WhyUsBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	const addReason = () => {
		onUpdate({
			...data,
			reasons: [
				...data.reasons,
				{ icon: "✨", title: "New Reason", description: "Reason description" },
			],
		});
	};

	const removeReason = (index: number) => {
		onUpdate({
			...data,
			reasons: data.reasons.filter((_, i) => i !== index),
		});
	};

	const updateReason = (index: number, reason: WhyUsItem) => {
		const newReasons = [...data.reasons];
		newReasons[index] = reason;
		onUpdate({ ...data, reasons: newReasons });
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Section Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Subtitle
				</label>
				<input
					type="text"
					value={data.subtitle || ""}
					onChange={(e) => onUpdate({ ...data, subtitle: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<div className="flex items-center justify-between mb-2">
					<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
						Reasons
					</label>
					<button
						onClick={addReason}
						className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
						+ Add
					</button>
				</div>

				<div className="space-y-3">
					{data.reasons.map((reason, index) => (
						<div
							key={index}
							className="p-3 border border-gray-200 dark:border-zinc-700 rounded-lg space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
									Reason {index + 1}
								</span>
								<button
									onClick={() => removeReason(index)}
									className="text-red-600 hover:text-red-700 text-sm">
									Remove
								</button>
							</div>

							<input
								type="text"
								value={reason.icon}
								onChange={(e) =>
									updateReason(index, { ...reason, icon: e.target.value })
								}
								placeholder="Icon (emoji)"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<input
								type="text"
								value={reason.title}
								onChange={(e) =>
									updateReason(index, { ...reason, title: e.target.value })
								}
								placeholder="Title"
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>

							<textarea
								value={reason.description}
								onChange={(e) =>
									updateReason(index, {
										...reason,
										description: e.target.value,
									})
								}
								placeholder="Description"
								rows={2}
								className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ContactBlockConfig({
	data,
	onUpdate,
}: {
	data: ContactBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Phone Number
				</label>
				<input
					type="text"
					value={data.phoneNumber}
					onChange={(e) => onUpdate({ ...data, phoneNumber: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Email
				</label>
				<input
					type="email"
					value={data.email || ""}
					onChange={(e) => onUpdate({ ...data, email: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Description
				</label>
				<textarea
					value={data.description || ""}
					onChange={(e) => onUpdate({ ...data, description: e.target.value })}
					rows={3}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={data.showForm || false}
					onChange={(e) => onUpdate({ ...data, showForm: e.target.checked })}
					className="w-4 h-4"
				/>
				<label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
					Show Contact Form
				</label>
			</div>
		</div>
	);
}

function OrderFormBlockConfig({
	data,
	onUpdate,
}: {
	data: OrderFormBlockData;
	onUpdate: (data: BlockData) => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
	const [searching, setSearching] = useState(false);

	const searchProducts = async (query: string) => {
		if (!query) {
			setSearchResults([]);
			return;
		}

		setSearching(true);
		try {
			const res = await fetch(`/api/v1/admin/products?search=${query}&limit=5`);
			if (res.ok) {
				const result = await res.json();
				// API returns { success: true, data: { products: [...], pagination: {...} } }
				const products = result.success ? result.data.products : [];
				setSearchResults(
					products.map((p: any) => ({
						id: p.id,
						name: p.name,
						price: p.base_price, // Database uses base_price column
						description: p.description,
						image: p.images?.[0],
					})),
				);
			}
		} catch (error) {
			console.error("Error searching products:", error);
		} finally {
			setSearching(false);
		}
	};

	useEffect(() => {
		const timer = setTimeout(() => searchProducts(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const addProduct = (product: ProductOption) => {
		if (!data.productOptions.find((p) => p.id === product.id)) {
			onUpdate({
				...data,
				productOptions: [...data.productOptions, product],
			});
		}
		setSearchQuery("");
		setSearchResults([]);
	};

	const removeProduct = (productId: string) => {
		onUpdate({
			...data,
			productOptions: data.productOptions.filter((p) => p.id !== productId),
		});
	};

	const toggleRequiredField = (field: string) => {
		const fields = data.requiredFields || [];
		if (fields.includes(field)) {
			onUpdate({
				...data,
				requiredFields: fields.filter((f) => f !== field),
			});
		} else {
			onUpdate({
				...data,
				requiredFields: [...fields, field],
			});
		}
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Title
				</label>
				<input
					type="text"
					value={data.title}
					onChange={(e) => onUpdate({ ...data, title: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Subtitle
				</label>
				<input
					type="text"
					value={data.subtitle || ""}
					onChange={(e) => onUpdate({ ...data, subtitle: e.target.value })}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
					Product Options
				</label>

				<div className="relative mb-2">
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search products..."
						className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
					/>

					{searching && (
						<div className="absolute top-full mt-1 w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg p-2 text-sm text-zinc-500 dark:text-zinc-400">
							Searching...
						</div>
					)}

					{searchResults.length > 0 && (
						<div className="absolute top-full mt-1 w-full bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
							{searchResults.map((product) => (
								<button
									key={product.id}
									onClick={() => addProduct(product)}
									className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-700 border-b border-gray-100 last:border-b-0">
									<div className="font-medium text-sm">{product.name}</div>
									<div className="text-xs text-zinc-500 dark:text-zinc-400">
										${product.price}
									</div>
								</button>
							))}
						</div>
					)}
				</div>

				<div className="space-y-2">
					{data.productOptions.map((product) => (
						<div
							key={product.id}
							className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 dark:border-zinc-700">
							<div className="flex-1">
								<div className="text-sm font-medium">{product.name}</div>
								<div className="text-xs text-zinc-500 dark:text-zinc-400">
									${product.price}
								</div>
							</div>
							<button
								onClick={() => removeProduct(product.id)}
								className="text-red-600 hover:text-red-700 text-sm">
								Remove
							</button>
						</div>
					))}

					{data.productOptions.length === 0 && (
						<p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
							No products selected
						</p>
					)}
				</div>
			</div>

			<div className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={data.showQuantity !== false}
					onChange={(e) =>
						onUpdate({ ...data, showQuantity: e.target.checked })
					}
					className="w-4 h-4"
				/>
				<label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
					Show Quantity Selector
				</label>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
					Required Fields
				</label>
				<div className="space-y-2">
					{["firstName", "lastName", "email", "phone", "address"].map(
						(field) => (
							<div
								key={field}
								className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={data.requiredFields?.includes(field) || false}
									onChange={() => toggleRequiredField(field)}
									className="w-4 h-4"
								/>
								<label className="text-sm text-zinc-900 dark:text-zinc-100 capitalize">
									{field.replace(/([A-Z])/g, " $1").trim()}
								</label>
							</div>
						),
					)}
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
					Success Message
				</label>
				<textarea
					value={data.successMessage || ""}
					onChange={(e) =>
						onUpdate({ ...data, successMessage: e.target.value })
					}
					rows={3}
					className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"
					placeholder="Thank you for your order!"
				/>
			</div>
		</div>
	);
}

// Wrapper component to handle Suspense for useSearchParams
export default function LandingPageBuilderWrapper({ params }: PageProps) {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">
					<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
				</div>
			}>
			<LandingPageBuilder params={params} />
		</Suspense>
	);
}
