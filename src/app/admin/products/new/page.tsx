"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2, Warehouse, Layers } from "lucide-react";

interface ProductVariation {
	id: string;
	name: string;
	sku: string;
	price: number;
	attributes: Record<string, string>;
	is_active: boolean;
	images: string[];
}

interface Category {
	id: string;
	name: string;
	slug: string;
	is_active: boolean;
}

interface Warehouse {
	id: string;
	name: string;
	address_city?: string;
	address_street?: string;
}

export default function NewProductPage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [isUploadingImages, setIsUploadingImages] = useState(false);
	const [categoriesLoading, setCategoriesLoading] = useState(true);
	const [categories, setCategories] = useState<Category[]>([]);
	const [imageUrlInput, setImageUrlInput] = useState("");
	const [imageError, setImageError] = useState("");
	const [variationImageUrlInput, setVariationImageUrlInput] = useState<Record<string, string>>({});
	const [uploadingVariationIdx, setUploadingVariationIdx] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<
		"basic" | "variations" | "unit_system" | "media" | "seo" | "trust_badges"
		>("basic");

	// Warehouses state
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

	// Variation warehouse inventory: key = "variationIndex-warehouseId" → quantity
	const [variationInventory, setVariationInventory] = useState<Record<string, number>>({});
	const [expandedVariations, setExpandedVariations] = useState<Record<number, boolean>>({});

	// File input refs for variations
	const variationFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

	// Unit System state
	const [unitSystem, setUnitSystem] = useState({
		baseUnit: "piece" as "piece" | "pair" | "dozen" | "pack",
		unitsPerPackage: 1,
		packageName: "Individual",
	});

	// Attribute definitions state
	interface AttributeDefinition {
		name: string;
		displayName: string;
		values: string[];
		displayOrder: number;
	}
	const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
	const [newAttrName, setNewAttrName] = useState("");
	const [newAttrValues, setNewAttrValues] = useState(""); // comma-separated
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_autoGenerateVariations, setAutoGenerateVariations] = useState(false);

	// Form state
	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		description: "",
		short_description: "",
		category_id: "",
		brand: "",
		base_price: "",
		compare_at_price: "",
		cost_price: "",
		sku: "",
		barcode: "",
		weight: "",
		is_active: true,
		is_featured: false,
		is_digital: false,
		seo_title: "",
		seo_description: "",
		seo_keywords: "",
	});

	const [variations, setVariations] = useState<ProductVariation[]>([]);
	const [images, setImages] = useState<string[]>([]);
	const [trustBadges, setTrustBadges] = useState<{ icon: string; text: string }[]>([]);
	const [newBadgeIcon, setNewBadgeIcon] = useState("truck");
	const [newBadgeText, setNewBadgeText] = useState("");

	const TRUST_BADGE_ICONS = [
		{ value: "truck", label: "Truck (Shipping)" },
		{ value: "shield", label: "Shield (Warranty/Security)" },
		{ value: "rotate-ccw", label: "Rotate (Returns)" },
		{ value: "zap", label: "Lightning (Fast Delivery)" },
		{ value: "check", label: "Check (Verified)" },
		{ value: "heart", label: "Heart (Guarantee)" },
		{ value: "star", label: "Star (Rating)" },
	];

	const addImageUrl = () => {
		const trimmedUrl = imageUrlInput.trim();

		if (!trimmedUrl) {
			setImageError("Enter an image URL to add");
			return;
		}

		try {
			const parsedUrl = new URL(trimmedUrl);
			if (!["http:", "https:"].includes(parsedUrl.protocol)) {
				throw new Error("Invalid protocol");
			}
		} catch {
			setImageError("Enter a valid image URL");
			return;
		}

		setImages((prev) => Array.from(new Set([...prev, trimmedUrl])));
		setImageUrlInput("");
		setImageError("");
	};

	const addVariationImageUrl = (variationIdx: number) => {
		const key = `var-${variationIdx}`;
		const trimmedUrl = variationImageUrlInput[key]?.trim() || "";

		if (!trimmedUrl) {
			setImageError("Enter an image URL to add");
			return;
		}

		try {
			const parsedUrl = new URL(trimmedUrl);
			if (!["http:", "https:"].includes(parsedUrl.protocol)) {
				throw new Error("Invalid protocol");
			}
		} catch {
			setImageError("Enter a valid image URL");
			return;
		}

		updateVariation(variationIdx, "images",
			Array.from(new Set([...variations[variationIdx].images, trimmedUrl]))
		);
		setVariationImageUrlInput((prev) => ({ ...prev, [key]: "" }));
		setImageError("");
	};

	const triggerVariationImageUpload = (variationIdx: number) => {
		variationFileInputRefs.current[variationIdx]?.click();
	};

	const handleVariationImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
		variationIdx: number,
	) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0) return;

		setUploadingVariationIdx(variationIdx);
		setImageError("");

		try {
			const uploadedUrls = await Promise.all(
				files.map(async (file) => {
					const uploadData = new FormData();
					uploadData.append("file", file);
					uploadData.append("bucket", "products");
					uploadData.append("folder", formData.slug || "draft-products");

					const response = await fetch("/api/v1/storage/upload", {
						method: "POST",
						body: uploadData,
					});

					const raw = await response.text();
					let result: {
						success?: boolean;
						data?: { publicUrl?: string };
						publicUrl?: string;
						error?: { message?: string };
					} | null = null;

					if (raw) {
						try {
							result = JSON.parse(raw);
						} catch {
							result = null;
						}
					}
					if (!response.ok) {
						throw new Error(
							result?.error?.message ||
								`Failed to upload ${file.name} (status ${response.status})`,
						);
					}

					const publicUrl = result?.data?.publicUrl || result?.publicUrl;
					if (!publicUrl) {
						throw new Error(`Upload completed but no URL returned for ${file.name}`);
					}

					return publicUrl;
				}),
			);

			updateVariation(variationIdx, "images",
				Array.from(new Set([...variations[variationIdx].images, ...uploadedUrls.filter(Boolean)]))
			);
		} catch (error) {
			setImageError(
				error instanceof Error ? error.message : "Failed to upload images",
			);
		} finally {
			setUploadingVariationIdx(null);
			e.target.value = "";
		}
	};

	const handleImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(e.target.files || []);
		if (files.length === 0) return;

		setIsUploadingImages(true);
		setImageError("");

		try {
			const uploadedUrls = await Promise.all(
				files.map(async (file) => {
					const uploadData = new FormData();
					uploadData.append("file", file);
					uploadData.append("bucket", "products");
					uploadData.append("folder", formData.slug || "draft-products");

					const response = await fetch("/api/v1/storage/upload", {
						method: "POST",
						body: uploadData,
					});

					const raw = await response.text();
					let result: {
						success?: boolean;
						data?: { publicUrl?: string };
						publicUrl?: string;
						error?: { message?: string };
					} | null = null;

					if (raw) {
						try {
							result = JSON.parse(raw);
						} catch {
							result = null;
						}
					}
					if (!response.ok) {
						throw new Error(
							result?.error?.message ||
								`Failed to upload ${file.name} (status ${response.status})`,
						);
					}

					const publicUrl = result?.data?.publicUrl || result?.publicUrl;
					if (!publicUrl) {
						throw new Error(`Upload completed but no URL returned for ${file.name}`);
					}

					return publicUrl;
				}),
			);

			setImages((prev) =>
				Array.from(new Set([...prev, ...uploadedUrls.filter(Boolean)])),
			);
		} catch (error) {
			setImageError(
				error instanceof Error ? error.message : "Failed to upload images",
			);
		} finally {
			setIsUploadingImages(false);
			e.target.value = "";
		}
	};

	useEffect(() => {
		fetchCategories();
		fetchWarehouses();
	}, []);

	const fetchCategories = async () => {
		try {
			const response = await fetch("/api/v1/categories");
			const data = await response.json();
			if (data.success) {
				setCategories(data.data || []);
			} else {
				console.error("Failed to fetch categories:", data.error);
			}
		} catch (error) {
			console.error("Error fetching categories:", error);
		} finally {
			setCategoriesLoading(false);
		}
	};

	const fetchWarehouses = async () => {
		try {
			const response = await fetch("/api/v1/admin/warehouses");
			const data = await response.json();
			if (data.success) {
				setWarehouses(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching warehouses:", error);
		}
	};

	// ----- Variation helpers -----
	const generateVariationsFromAttrs = (attrs: AttributeDefinition[]) => {
		if (attrs.length === 0) return;
		if (!formData.sku.trim()) {
			alert("Set the product SKU first before generating variations.");
			return;
		}
		const combos: Record<string, string>[] = [];
		const gen = (a: AttributeDefinition[], cur: Record<string, string> = {}, idx = 0): void => {
			if (idx === a.length) { combos.push({ ...cur }); return; }
			a[idx].values.forEach((v) => gen(a, { ...cur, [a[idx].name]: v }, idx + 1));
		};
		gen(attrs);
		const generated = combos.map((combo, i) => ({
			id: `auto-${Date.now()}-${i}`,
			name: Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(", "),
			sku: `${formData.sku}-${String(i + 1).padStart(3, "0")}`,
			price: parseFloat(formData.base_price) || 0,
			attributes: combo,
			is_active: true,
			images: [],
		}));
		setVariations(generated);
		setAutoGenerateVariations(true);
		setExpandedVariations({});
		setVariationInventory({});
	};

	const updateInventory = (variationIndex: number, warehouseId: string, qty: string) => {
		const key = `${variationIndex}-${warehouseId}`;
		setVariationInventory((prev) => ({ ...prev, [key]: parseInt(qty) || 0 }));
	};

	const getTotalInventory = (variationIndex: number) => {
		return warehouses.reduce((total, wh) => {
			return total + (variationInventory[`${variationIndex}-${wh.id}`] || 0);
		}, 0);
	};

	const toggleVariationExpand = (index: number) => {
		setExpandedVariations((prev) => ({ ...prev, [index]: !prev[index] }));
	};

	const handleInputChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>,
	) => {
		const { name, value, type } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]:
				type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
		}));
	};

	const generateSlug = () => {
		const slug = formData.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		setFormData((prev) => ({ ...prev, slug }));
	};

	const addVariation = () => {
		const newVariation: ProductVariation = {
			id: `temp-${Date.now()}`,
			name: "",
			sku: "",
			price: 0,
			attributes: {},
			is_active: true,
			images: [],
		};
		setVariations((prev) => [...prev, newVariation]);
	};

	const updateVariation = (
		index: number,
		field: keyof ProductVariation,
		value: unknown,
	) => {
		setVariations((prev) => {
			const updated = [...prev];
			updated[index] = { ...updated[index], [field]: value };
			return updated;
		});
	};

	const removeVariation = (index: number) => {
		setVariations((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			setImageError("");
			const normalizedVariations = variations
				.map((variation, varIndex) => ({
					name: variation.name.trim(),
					sku: variation.sku.trim(),
					price: variation.price,
					attributes: variation.attributes,
					is_active: variation.is_active,
					// Convert UI inventory map → warehouse_stocks array expected by API
					warehouse_stocks: warehouses
						.map((wh) => ({
							warehouse_id: wh.id,
							quantity_in_packages: variationInventory[`${varIndex}-${wh.id}`] || 0,
						}))
						.filter((ws) => ws.quantity_in_packages > 0),
				}))
				.filter(
					(variation) =>
						variation.name || variation.sku,
				);

			const hasIncompleteVariation = normalizedVariations.some(
				(variation) =>
					!variation.name || !variation.sku,
			);

			if (!formData.sku.trim()) {
				throw new Error("SKU is required");
			}

			if (hasIncompleteVariation) {
				throw new Error(
					"Each variation must include a name and SKU",
				);
			}

			// Prepare product data
			const productData = {
				...formData,
				sku: formData.sku.trim(),
				name: formData.name.trim(),
				slug: formData.slug.trim(),
				brand: formData.brand.trim(),
				barcode: formData.barcode.trim(),
				seo_title: formData.seo_title.trim(),
				seo_description: formData.seo_description.trim(),
				seo_keywords: formData.seo_keywords.trim(),
				base_price: parseFloat(formData.base_price) || 0,
				compare_at_price: formData.compare_at_price
					? parseFloat(formData.compare_at_price)
					: null,
				cost_price: formData.cost_price
					? parseFloat(formData.cost_price)
					: null,
				weight: formData.weight ? parseFloat(formData.weight) : null,
				variations: normalizedVariations,
				images,
				trust_badges: trustBadges,
				// New fields
				unit_system: unitSystem,
				attribute_definitions: attributeDefinitions,
			};

			const response = await fetch("/api/v1/admin/products", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(productData),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => null);
				const details = errorData?.error?.details
					? Object.entries(errorData.error.details)
							.map(([field, messages]) => {
								const text = Array.isArray(messages)
									? messages.join(", ")
									: String(messages);
								return `${field}: ${text}`;
							})
							.join("\n")
					: "";
				throw new Error(
					details
						? `${errorData?.error?.message || "Failed to create product"}\n${details}`
						: (errorData?.error?.message || "Failed to create product"),
				);
			}

			router.push("/admin/products");
		} catch (error) {
			console.error("Error creating product:", error);
			alert(
				error instanceof Error
					? error.message
					: "Failed to create product. Please try again.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
						New Product
					</h1>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Add a new product to your store
					</p>
				</div>
				<Link
					href="/admin/products"
					className="px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
					Cancel
				</Link>
			</div>

			{/* Tabs */}
			<div className="border-b border-gray-200">
				<nav className="-mb-px flex space-x-8">
					{[
						{ id: "basic", label: "Basic Info" },
						{ id: "variations", label: "Variations & Inventory" },
						{ id: "unit_system", label: "Unit System" },
						{ id: "media", label: "Media" },
						{ id: "seo", label: "SEO" },
						{ id: "trust_badges", label: "Trust Badges" },
					].map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id as typeof activeTab)}
							className={`py-4 px-1 border-b-2 font-medium text-sm ${
								activeTab === tab.id
									? "border-blue-500 text-blue-600"
									: "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-gray-300"
							}`}>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			<form onSubmit={handleSubmit}>
				{/* Basic Info Tab */}
				{activeTab === "basic" && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Product Details
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Product Name *
									</label>
									<div className="flex gap-2">
										<input
											type="text"
											name="name"
											value={formData.name}
											onChange={handleInputChange}
											required
											className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
											placeholder="Enter product name"
										/>
										<button
											type="button"
											onClick={generateSlug}
											className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
											Generate Slug
										</button>
									</div>
								</div>

								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Slug *
									</label>
									<input
										type="text"
										name="slug"
										value={formData.slug}
										onChange={handleInputChange}
										required
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="product-url-slug"
									/>
								</div>

								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Short Description
									</label>
									<input
										type="text"
										name="short_description"
										value={formData.short_description}
										onChange={handleInputChange}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Brief product description"
									/>
								</div>

								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Full Description
									</label>
									<textarea
										name="description"
										value={formData.description}
										onChange={handleInputChange}
										rows={4}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Detailed product description"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Category *
									</label>
									<select
										name="category_id"
										value={formData.category_id}
										onChange={handleInputChange}
										required
										disabled={categoriesLoading}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed">
										<option value="">
											{categoriesLoading
												? "Loading categories..."
												: "Select a category"}
										</option>
										{categories.map((cat) => (
											<option
												key={cat.id}
												value={cat.id}>
												{cat.name}
											</option>
										))}
									</select>
									{!categoriesLoading && categories.length === 0 && (
										<p className="mt-1 text-sm text-red-600">
											No categories available. Please create categories first.
										</p>
									)}
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Brand
									</label>
									<input
										type="text"
										name="brand"
										value={formData.brand}
										onChange={handleInputChange}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Brand name"
									/>
								</div>
							</div>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Pricing
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Base Price *
									</label>
									<div className="relative">
										<span className="absolute left-3 top-2 text-zinc-500 dark:text-zinc-400">
											$
										</span>
										<input
											type="number"
											name="base_price"
											value={formData.base_price}
											onChange={handleInputChange}
											required
											step="0.01"
											min="0"
											className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
											placeholder="0.00"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Compare at Price
									</label>
									<div className="relative">
										<span className="absolute left-3 top-2 text-zinc-500 dark:text-zinc-400">
											$
										</span>
										<input
											type="number"
											name="compare_at_price"
											value={formData.compare_at_price}
											onChange={handleInputChange}
											step="0.01"
											min="0"
											className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
											placeholder="0.00"
										/>
									</div>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										Original price for sale display
									</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Cost Price
									</label>
									<div className="relative">
										<span className="absolute left-3 top-2 text-zinc-500 dark:text-zinc-400">
											$
										</span>
										<input
											type="number"
											name="cost_price"
											value={formData.cost_price}
											onChange={handleInputChange}
											step="0.01"
											min="0"
											className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
											placeholder="0.00"
										/>
									</div>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										For profit calculations
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Inventory
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										SKU
									</label>
									<input
										type="text"
										name="sku"
										value={formData.sku}
										onChange={handleInputChange}
										required
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Stock keeping unit"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Barcode
									</label>
									<input
										type="text"
										name="barcode"
										value={formData.barcode}
										onChange={handleInputChange}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="UPC, EAN, etc."
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Weight (kg)
									</label>
									<input
										type="number"
										name="weight"
										value={formData.weight}
										onChange={handleInputChange}
										step="0.01"
										min="0"
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="0.00"
									/>
								</div>
							</div>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Status
							</h2>

							<div className="space-y-4">
								<label className="flex items-center gap-3">
									<input
										type="checkbox"
										name="is_active"
										checked={formData.is_active}
										onChange={handleInputChange}
										className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									/>
									<span className="text-sm text-zinc-900 dark:text-zinc-100">
										Product is active and visible
									</span>
								</label>

								<label className="flex items-center gap-3">
									<input
										type="checkbox"
										name="is_featured"
										checked={formData.is_featured}
										onChange={handleInputChange}
										className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									/>
									<span className="text-sm text-zinc-900 dark:text-zinc-100">
										Featured product (shown on homepage)
									</span>
								</label>

								<label className="flex items-center gap-3">
									<input
										type="checkbox"
										name="is_digital"
										checked={formData.is_digital}
										onChange={handleInputChange}
										className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
									/>
									<span className="text-sm text-zinc-900 dark:text-zinc-100">
										Digital product (no shipping required)
									</span>
								</label>
							</div>
						</div>
					</div>
				)}

				{/* Variations & Inventory Tab */}
				{activeTab === "variations" && (
					<div className="space-y-6">

						{/* ── STEP 1: Define Attributes ── */}
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
								<Layers size={18} className="text-blue-500" />
								Step 1 — Define Variation Attributes
							</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
								Add attributes like Color or Size. All combinations will be auto-generated.
							</p>

							{/* Existing attributes */}
							{attributeDefinitions.length > 0 && (
								<div className="space-y-2 mb-5">
									{attributeDefinitions.map((attr, idx) => (
										<div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-zinc-700/40 border border-gray-200 dark:border-zinc-700 rounded-lg">
											<div className="flex-1">
												<p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
													{attr.displayName}
												</p>
												<div className="flex flex-wrap gap-1 mt-1">
													{attr.values.map((v) => (
														<span key={v} className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
															{v}
														</span>
													))}
												</div>
											</div>
											<button
												type="button"
												onClick={() => setAttributeDefinitions((prev) => prev.filter((_, i) => i !== idx))}
												className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition">
												<Trash2 size={15} />
											</button>
										</div>
									))}
								</div>
							)}

							{/* Add new attribute form */}
							<div className="border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-4">
								<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Add Attribute</p>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									<div>
										<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Attribute Name (e.g. color, size)</label>
										<input
											type="text"
											value={newAttrName}
											onChange={(e) => setNewAttrName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
											className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
											placeholder="color"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Values (comma-separated)</label>
										<input
											type="text"
											value={newAttrValues}
											onChange={(e) => setNewAttrValues(e.target.value)}
											className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
											placeholder="Red, Blue, Green"
										/>
									</div>
								</div>
								<button
									type="button"
									onClick={() => {
										const name = newAttrName.trim();
										const values = newAttrValues.split(",").map((v) => v.trim()).filter(Boolean);
										if (!name || values.length === 0) return;
										if (attributeDefinitions.some((a) => a.name === name)) {
											alert(`Attribute "${name}" already exists`);
											return;
										}
										setAttributeDefinitions((prev) => [
											...prev,
											{
												name,
												displayName: name.charAt(0).toUpperCase() + name.slice(1),
												values,
												displayOrder: attributeDefinitions.length,
											},
										]);
										setNewAttrName("");
										setNewAttrValues("");
									}}
									className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
									<Plus size={15} /> Add Attribute
								</button>
							</div>

							{/* Generate button */}
							{attributeDefinitions.length > 0 && (
								<div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg flex items-start gap-3">
									<div className="flex-1">
										<p className="text-sm font-medium text-amber-800 dark:text-amber-300">
											Auto-generate&nbsp;
											<strong>
												{attributeDefinitions.reduce((t, a) => t === 0 ? a.values.length : t * a.values.length, 0)}
											</strong>
											&nbsp;variation combinations
										</p>
										<p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
											{attributeDefinitions.map((a) => `${a.displayName} (${a.values.join(", ")})`).join(" × ")}
										</p>
									</div>
									<button
										type="button"
										onClick={() => generateVariationsFromAttrs(attributeDefinitions)}
										className="px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 whitespace-nowrap">
										Generate Variations →
									</button>
								</div>
							)}
						</div>

						{/* ── STEP 2: Variation Summary + Warehouse Inventory ── */}
						{variations.length > 0 && (
							<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
								<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
									<Warehouse size={18} className="text-blue-500" />
									Step 2 — Warehouse Inventory
								</h2>
								<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
									{variations.length} variation{variations.length !== 1 ? "s" : ""} generated. Expand each to set stock per warehouse.
								</p>

								{warehouses.length === 0 && (
									<div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
										No warehouses found. <a href="/admin/inventory" className="underline font-medium">Add warehouses</a> first to assign stock.
									</div>
								)}

								<div className="space-y-2">
									{variations.map((variation, idx) => {
										const total = getTotalInventory(idx);
										return (
											<div key={variation.id} className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
												{/* Variation header row */}
												<button
													type="button"
													onClick={() => toggleVariationExpand(idx)}
													className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-700/40 transition">
													<div className="flex items-center gap-3 flex-1 text-left">
														<div
															className="w-3 h-3 rounded-full flex-shrink-0"
															style={{ background: `hsl(${idx * 60}, 65%, 50%)` }}
														/>
														<div>
															<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{variation.name}</p>
															<p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
																SKU: {variation.sku}&nbsp;·&nbsp;
																<span
																	className="inline-flex items-center gap-0.5"
																	onClick={(e) => e.stopPropagation()}
																>
																	<span className="text-zinc-400">$</span>
																	<input
																		type="number"
																		value={variation.price}
																		onChange={(e) => updateVariation(idx, "price", parseFloat(e.target.value) || 0)}
																		step="0.01" min="0"
																		className="w-20 px-1.5 py-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
																	/>
																</span>
															</p>
														</div>
													</div>
													<div className="flex items-center gap-6">
														<div className="text-right">
															<p className="text-xs text-zinc-400">Total Stock</p>
															<p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
																{total} {unitSystem.packageName}{total !== 1 ? "s" : ""}
															</p>
														</div>
														<ChevronDown
															size={18}
															className="text-zinc-400 flex-shrink-0 transition-transform"
															style={{ transform: expandedVariations[idx] ? "rotate(180deg)" : "rotate(0deg)" }}
														/>
													</div>
												</button>

												{/* Per-warehouse grid */}
												{expandedVariations[idx] && (
													<div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/40">
														{/* Editable variation fields */}
														<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
															<div>
																<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Variation Name</label>
																<input
																	type="text"
																	value={variation.name}
																	onChange={(e) => updateVariation(idx, "name", e.target.value)}
																	className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">SKU</label>
																<input
																	type="text"
																	value={variation.sku}
																	onChange={(e) => updateVariation(idx, "sku", e.target.value)}
																	className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Price ($)</label>
																<input
																	type="number"
																	value={variation.price}
																	onChange={(e) => updateVariation(idx, "price", parseFloat(e.target.value) || 0)}
																	step="0.01" min="0"
																	className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
																/>
															</div>
														</div>

														{/* Variation Images */}
														<div className="mb-4">
															<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
																Variation Images
															</p>
															{variation.images.length > 0 && (
																<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
																	{variation.images.map((img, imgIdx) => (
																		<div key={imgIdx} className="relative group">
																			<div className="aspect-square bg-gray-100 dark:bg-zinc-700 rounded-lg overflow-hidden">
																				<img
																					src={img}
																					alt={`Variation image ${imgIdx + 1}`}
																					className="w-full h-full object-cover"
																				/>
																			</div>
																			<button
																				type="button"
																				onClick={() => updateVariation(
																					idx,
																					"images",
																					variation.images.filter((_, i) => i !== imgIdx)
																				)}
																				className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
																				<Trash2 size={14} />
																			</button>
																		</div>
																	))}
																</div>
															)}
															<div className="flex gap-2">
																<button
																	type="button"
																	onClick={() => triggerVariationImageUpload(idx)}
																	disabled={uploadingVariationIdx === idx}
																	className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-600 transition text-zinc-600 dark:text-zinc-300 flex items-center justify-center gap-1.5 disabled:opacity-50">
																	<Plus size={14} />
																	Upload Image
																</button>
																<input
																	ref={(el) => {
																		if (el) variationFileInputRefs.current[idx] = el;
																	}}
																	type="file"
																	multiple
																	accept="image/*"
																	onChange={(e) => handleVariationImageUpload(e, idx)}
																	className="hidden"
																/>
															</div>
															<div className="mt-2 flex gap-2">
																<input
																	type="text"
																	placeholder="Or paste image URL..."
																	value={variationImageUrlInput[`var-${idx}`] || ""}
																	onChange={(e) => setVariationImageUrlInput((prev) => ({ ...prev, [`var-${idx}`]: e.target.value }))}
																	className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
																/>
																<button
																	type="button"
																	onClick={() => addVariationImageUrl(idx)}
																	disabled={uploadingVariationIdx === idx}
																	className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50">
																	Add
																</button>
															</div>
															{uploadingVariationIdx === idx && (
																<p className="text-xs text-blue-500 mt-2">Uploading...</p>
															)}
														</div>

														{/* Warehouse inventory inputs */}
														{warehouses.length > 0 && (
															<>
																<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Stock per Warehouse</p>
																<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
																	{warehouses.map((wh) => {
																		const key = `${idx}-${wh.id}`;
																		const qty = variationInventory[key] || 0;
																		return (
																			<div key={wh.id} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3">
																				<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
																					{wh.name}
																				</label>
																				{wh.address_city && (
																					<p className="text-xs text-zinc-400 mb-2">{wh.address_city}</p>
																				)}
																				<input
																					type="number"
																					value={qty}
																					onChange={(e) => updateInventory(idx, wh.id, e.target.value)}
																					min="0"
																					placeholder="0"
																					className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
																				/>
																				{unitSystem.unitsPerPackage > 1 && (
																					<p className="text-xs text-zinc-400 mt-1">
																						= {qty * unitSystem.unitsPerPackage} individual {unitSystem.baseUnit}s
																					</p>
																				)}
																			</div>
																		);
																	})}
																</div>
															</>
														)}

														{/* Remove button */}
														<button
															type="button"
															onClick={() => removeVariation(idx)}
															className="mt-4 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition">
															<Trash2 size={13} /> Remove this variation
														</button>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* Manual add single variation */}
						{variations.length === 0 && attributeDefinitions.length === 0 && (
							<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6 text-center">
								<Layers size={36} className="mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
								<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No variations yet</p>
								<p className="text-xs text-zinc-400 mt-1 mb-4">Define attributes above and click "Generate Variations", or add a single variation manually.</p>
								<button
									type="button"
									onClick={addVariation}
									className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto">
									<Plus size={15} /> Add Variation Manually
								</button>
							</div>
						)}
					</div>
				)}

				{/* Media Tab */}
				{activeTab === "media" && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Product Images
							</h2>

							<div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
								<svg
									className="mx-auto h-12 w-12 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								<h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
									Upload images
								</h3>
								<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
									Drag and drop or click to upload
								</p>
								<p className="mt-1 text-xs text-gray-400">
									PNG, JPG, WebP up to 10MB
								</p>
								<input
									type="file"
									multiple
									accept="image/*"
									className="hidden"
									id="image-upload"
									onChange={handleImageUpload}
								/>
								<label
									htmlFor="image-upload"
									className={`mt-4 inline-block px-4 py-2 text-sm font-medium rounded-lg cursor-pointer ${
										isUploadingImages
											? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
											: "text-blue-600 bg-blue-50 hover:bg-blue-100"
									}`}>
									{isUploadingImages ? "Uploading..." : "Choose Files"}
								</label>
							</div>

							<div className="mt-6">
								<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
									Add Image URL
								</label>
								<div className="flex gap-2">
									<input
										type="url"
										value={imageUrlInput}
										onChange={(e) => {
											setImageUrlInput(e.target.value);
											if (imageError) setImageError("");
										}}
										className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="https://example.com/product-image.jpg"
									/>
									<button
										type="button"
										onClick={addImageUrl}
										className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
										Add Link
									</button>
								</div>
							</div>

							{imageError && (
								<p className="mt-3 text-sm text-red-600">{imageError}</p>
							)}

							{images.length > 0 && (
								<div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
									{images.map((image, index) => (
										<div
											key={index}
											className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
											<img
												src={image}
												alt={`Product ${index + 1}`}
												className="w-full h-full object-cover"
											/>
											<button
												type="button"
												onClick={() =>
													setImages((prev) =>
														prev.filter((_, i) => i !== index),
													)
												}
												className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-gray-100">
												<svg
													className="w-4 h-4 text-gray-600"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				)}

				{/* SEO Tab */}
				{activeTab === "seo" && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Search Engine Optimization
							</h2>

							<div className="space-y-6">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										SEO Title
									</label>
									<input
										type="text"
										name="seo_title"
										value={formData.seo_title}
										onChange={handleInputChange}
										maxLength={60}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Page title for search engines"
									/>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										{formData.seo_title.length}/60 characters
									</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Meta Description
									</label>
									<textarea
										name="seo_description"
										value={formData.seo_description}
										onChange={handleInputChange}
										maxLength={160}
										rows={3}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="Description shown in search results"
									/>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										{formData.seo_description.length}/160 characters
									</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Keywords
									</label>
									<input
										type="text"
										name="seo_keywords"
										value={formData.seo_keywords}
										onChange={handleInputChange}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
										placeholder="keyword1, keyword2, keyword3"
									/>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										Separate keywords with commas
									</p>
								</div>

								{/* Preview */}
								<div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 bg-gray-50">
									<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
										Search Result Preview
									</p>
									<div className="bg-white p-4 rounded border">
										<p className="text-blue-600 text-lg hover:underline cursor-pointer">
											{formData.seo_title || formData.name || "Product Title"}
										</p>
										<p className="text-green-700 text-sm">
											yourstore.com/products/{formData.slug || "product-slug"}
										</p>
										<p className="text-gray-600 text-sm mt-1">
											{formData.seo_description ||
												formData.short_description ||
												"Product description will appear here..."}
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}


				{/* Unit System Tab */}
				{activeTab === "unit_system" && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
								Unit System
							</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
								Configure how this product is packaged and sold. For example, socks may be sold in packs of 6.
							</p>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Base Unit
									</label>
									<select
										value={unitSystem.baseUnit}
										onChange={(e) =>
											setUnitSystem((u) => ({ ...u, baseUnit: e.target.value as "piece" | "pair" | "dozen" | "pack" }))
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none">
										<option value="piece">Piece</option>
										<option value="pair">Pair</option>
										<option value="dozen">Dozen</option>
										<option value="pack">Pack</option>
									</select>
									<p className="mt-1 text-xs text-zinc-400">The individual unit of the product</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Units per Package
									</label>
									<input
										type="number"
										min={1}
										value={unitSystem.unitsPerPackage}
										onChange={(e) =>
											setUnitSystem((u) => ({ ...u, unitsPerPackage: parseInt(e.target.value) || 1 }))
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									/>
									<p className="mt-1 text-xs text-zinc-400">Number of {unitSystem.baseUnit}s in each package</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Package Name
									</label>
									<input
										type="text"
										value={unitSystem.packageName}
										onChange={(e) =>
											setUnitSystem((u) => ({ ...u, packageName: e.target.value }))
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="e.g. 6-Pack, Dozen, Bundle"
									/>
									<p className="mt-1 text-xs text-zinc-400">Displayed name for the package</p>
								</div>
							</div>

							{/* Preview */}
							<div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">
								<p className="text-sm font-medium text-blue-800 dark:text-blue-300">
									Packaging Summary
								</p>
								<p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
									Each <strong>{unitSystem.packageName}</strong> contains{" "}
									<strong>{unitSystem.unitsPerPackage} {unitSystem.baseUnit}{unitSystem.unitsPerPackage > 1 ? "s" : ""}</strong>.
									Inventory is tracked in packages.
								</p>
								<p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
									Example: 10 packages = {10 * unitSystem.unitsPerPackage} individual {unitSystem.baseUnit}s.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Trust Badges Tab */}
				{activeTab === "trust_badges" && (
					<div className="space-y-6">
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
								Trust Badges
							</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
								Add trust signals shown on the product page (e.g. Free Shipping, Warranty, Returns).
							</p>

							{/* Existing badges */}
							{trustBadges.length > 0 && (
								<div className="space-y-2 mb-6">
									{trustBadges.map((badge, index) => (
										<div
											key={index}
											className="flex items-center gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg">
											<span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 w-28 text-center flex-shrink-0">
												{badge.icon}
											</span>
											<span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
												{badge.text}
											</span>
											<button
												type="button"
												onClick={() =>
													setTrustBadges((prev) => prev.filter((_, i) => i !== index))
												}
												className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
												Remove
											</button>
										</div>
									))}
								</div>
							)}

							{/* Add new badge */}
							<div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
								<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Add a badge</p>
								<div className="flex gap-3 flex-wrap">
									<select
										value={newBadgeIcon}
										onChange={(e) => setNewBadgeIcon(e.target.value)}
										className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
										{TRUST_BADGE_ICONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
									<input
										type="text"
										value={newBadgeText}
										onChange={(e) => setNewBadgeText(e.target.value)}
										placeholder="Badge text (e.g. Free Shipping)"
										className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
									/>
									<button
										type="button"
										onClick={() => {
											const text = newBadgeText.trim();
											if (!text) return;
											setTrustBadges((prev) => [
												...prev,
												{ icon: newBadgeIcon, text },
											]);
											setNewBadgeText("");
										}}
										className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
										Add Badge
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Form Actions */}
				<div className="flex items-center justify-end gap-4 mt-6 pt-6 border-t border-gray-200">
					<Link
						href="/admin/products"
						className="px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
						Cancel
					</Link>
					<button
						type="submit"
						disabled={isLoading}
						className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
						{isLoading ? "Creating..." : "Create Product"}
					</button>
				</div>
			</form>
		</div>
	);
}
