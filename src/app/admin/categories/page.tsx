"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Category {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	status: string;
	is_active?: boolean;
	parent_id: string | null;
	meta_title?: string | null;
	meta_description?: string | null;
	metadata?: {
		meta_title?: string | null;
		meta_description?: string | null;
	};
	created_at: string;
	product_count?: number;
}

export default function AdminCategoriesPage() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		slug: "",
		description: "",
		status: "active",
		meta_title: "",
		meta_description: "",
	});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		fetchCategories();
	}, []);

	const fetchCategories = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/v1/categories?include_inactive=true");
			const data = await response.json();
			if (data.success) {
				// Fetch product counts for each category
				const categoriesWithCounts = await Promise.all(
					(data.data || []).map(async (category: Category) => {
						const status =
							category.status || (category.is_active ? "active" : "inactive");
						const metaTitle =
							category.meta_title ?? category.metadata?.meta_title ?? null;
						const metaDescription =
							category.meta_description ??
							category.metadata?.meta_description ??
							null;

						try {
							const productsRes = await fetch(
								`/api/v1/products?category_id=${category.id}&limit=1`,
							);
							const productsData = await productsRes.json();
							return {
								...category,
								status,
								meta_title: metaTitle,
								meta_description: metaDescription,
								product_count: productsData.meta?.total || 0,
							};
						} catch {
							return {
								...category,
								status,
								meta_title: metaTitle,
								meta_description: metaDescription,
								product_count: 0,
							};
						}
					}),
				);
				setCategories(categoriesWithCounts);
			} else {
				setCategories([]);
			}
		} catch (err) {
			console.error("Failed to fetch categories:", err);
			setCategories([]);
		} finally {
			setLoading(false);
		}
	};

	const filteredCategories = categories.filter((c) => {
		const matchesSearch =
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.slug.toLowerCase().includes(search.toLowerCase());
		const matchesStatus = !statusFilter || c.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError("");

		try {
			const url = editingId
				? `/api/v1/categories/${editingId}`
				: "/api/v1/categories";
			const method = editingId ? "PUT" : "POST";

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (data.success) {
				await fetchCategories();
				resetForm();
				setShowForm(false);
			} else {
				setError(data.error?.message || "Failed to save category");
			}
		} catch {
			setError("An error occurred while saving the category");
		} finally {
			setSubmitting(false);
		}
	};

	const handleEdit = (category: Category) => {
		setEditingId(category.id);
		setFormData({
			name: category.name,
			slug: category.slug,
			description: category.description || "",
			status: category.status,
			meta_title: category.meta_title || "",
			meta_description: category.meta_description || "",
		});
		setShowForm(true);
		setError("");
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this category?")) return;

		try {
			const response = await fetch(`/api/v1/categories/${id}`, {
				method: "DELETE",
			});

			const data = await response.json();

			if (data.success) {
				await fetchCategories();
			} else {
				alert(data.error?.message || "Failed to delete category");
			}
		} catch {
			alert("An error occurred while deleting the category");
		}
	};

	const resetForm = () => {
		setFormData({
			name: "",
			slug: "",
			description: "",
			status: "active",
			meta_title: "",
			meta_description: "",
		});
		setEditingId(null);
		setError("");
	};

	const generateSlug = (name: string) => {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Categories
					</h1>
					<p className="text-zinc-500 text-sm mt-1">
						{loading
							? "Loading categories..."
							: `${filteredCategories.length} categories`}
					</p>
				</div>
				<button
					onClick={() => {
						resetForm();
						setShowForm(true);
					}}
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Add Category
				</button>
			</div>

			{/* Form */}
			{showForm && (
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
						{editingId ? "Edit Category" : "Add New Category"}
					</h2>

					{error && (
						<div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
							{error}
						</div>
					)}

					<form
						onSubmit={handleSubmit}
						className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Name *
								</label>
								<input
									type="text"
									value={formData.name}
									onChange={(e) => {
										setFormData({
											...formData,
											name: e.target.value,
											slug: generateSlug(e.target.value),
										});
									}}
									className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Slug *
								</label>
								<input
									type="text"
									value={formData.slug}
									onChange={(e) =>
										setFormData({ ...formData, slug: e.target.value })
									}
									className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
									required
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Description
							</label>
							<textarea
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								rows={3}
								className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Status
							</label>
							<select
								value={formData.status}
								onChange={(e) =>
									setFormData({ ...formData, status: e.target.value })
								}
								className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</div>

						<div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
							<h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
								SEO Settings
							</h3>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Meta Title
									</label>
									<input
										type="text"
										value={formData.meta_title}
										onChange={(e) =>
											setFormData({ ...formData, meta_title: e.target.value })
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="Leave empty to use category name"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Meta Description
									</label>
									<textarea
										value={formData.meta_description}
										onChange={(e) =>
											setFormData({
												...formData,
												meta_description: e.target.value,
											})
										}
										rows={2}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>
							</div>
						</div>

						<div className="flex gap-2 pt-4">
							<button
								type="submit"
								disabled={submitting}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
								{submitting ? "Saving..." : "Save Category"}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowForm(false);
									resetForm();
								}}
								className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700">
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<input
						type="text"
						placeholder="Search categories..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
					/>
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>

				<div className="w-full sm:w-48">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
						<option value="">All Status</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</div>
			</div>

			{/* Categories Grid */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
				{loading ? (
					<div className="p-8 text-center">
						<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
					</div>
				) : filteredCategories.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">
						{search ? "No categories match your search" : "No categories yet"}
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
						{filteredCategories.map((category) => (
							<div
								key={category.id}
								className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
								<div className="flex items-start justify-between mb-2">
									<div className="flex-1">
										<h3 className="font-semibold text-zinc-900 dark:text-white">
											{category.name}
										</h3>
										<p className="text-sm text-zinc-500 font-mono">
											/{category.slug}
										</p>
									</div>
									<span
										className={`px-2 py-1 text-xs rounded ${
											category.status === "active"
												? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
												: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
										}`}>
										{category.status}
									</span>
								</div>

								{category.description && (
									<p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
										{category.description}
									</p>
								)}

								<div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
									<span className="text-sm text-zinc-500">
										{category.product_count || 0} products
									</span>

									<div className="flex items-center gap-2">
										<button
											onClick={() => handleEdit(category)}
											className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
											title="Edit">
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
										<Link
											href={`/categories/${category.slug}`}
											target="_blank"
											className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
											title="View">
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</Link>
										<button
											onClick={() => handleDelete(category.id)}
											className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
											title="Delete">
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
