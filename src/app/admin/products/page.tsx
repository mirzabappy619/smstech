"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Product {
	id: string;
	name: string;
	slug: string;
	sku: string;
	base_price: number;
	images: string[];
	is_active: boolean;
	is_featured: boolean;
	category: { id: string; name: string } | null;
	created_at: string;
}

interface Category {
	id: string;
	name: string;
	slug: string;
	is_active: boolean;
}

export default function AdminProductsPage() {
	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
	const [totalProducts, setTotalProducts] = useState(0);
	const [currentLimit, setCurrentLimit] = useState(50);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const fetchProducts = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				limit: currentLimit.toString(),
				show_all: "true",
			});
			if (categoryFilter) {
				params.append("category_id", categoryFilter);
			}

			const response = await fetch(`/api/v1/products?${params.toString()}`);
			const data = await response.json();
			if (data.success) {
				setProducts(data.data || []);
				const total = data.meta?.total ?? data.data?.length ?? 0;
				setTotalProducts(total);
			} else {
				setProducts([]);
				setTotalProducts(0);
			}
		} catch (err) {
			console.error("Failed to fetch products:", err);
			setProducts([]);
			setTotalProducts(0);
		} finally {
			setLoading(false);
		}
	}, [currentLimit, categoryFilter]);

	useEffect(() => {
		fetchProducts();
	}, [fetchProducts]);

	useEffect(() => {
		fetchCategories();
	}, []);



	const fetchCategories = async () => {
		try {
			const response = await fetch("/api/v1/categories");
			const data = await response.json();
			if (data.success) {
				setCategories(data.data || []);
			}
		} catch (error) {
			console.error("Error fetching categories:", error);
		}
	};

	const filteredProducts = (products || []).filter((p) => {
		const searchLower = (search || "").toLowerCase();
		const matchesSearch =
			(p?.name || "").toLowerCase().includes(searchLower) ||
			(p?.sku || "").toLowerCase().includes(searchLower);
		return matchesSearch;
	});

	const toggleSelectAll = () => {
		if (selectedProducts.length === filteredProducts.length && filteredProducts.length > 0) {
			setSelectedProducts([]);
		} else {
			setSelectedProducts(filteredProducts.map((p) => p.id).filter(Boolean));
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedProducts((prev) =>
			prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
		);
	};

	const handleBulkDelete = async () => {
		setDeleteError(null);
		setDeleting(true);
		try {
			const res = await fetch("/api/v1/products/bulk-delete", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: selectedProducts }),
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				setDeleteError(data.message || "Failed to delete products.");
				return;
			}
			setSelectedProducts([]);
			setShowDeleteModal(false);
			await fetchProducts();
		} catch {
			setDeleteError("An unexpected error occurred.");
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Bulk Delete Confirmation Modal */}
			{showDeleteModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => !deleting && setShowDeleteModal(false)}
					/>
					{/* Modal */}
					<div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
						{/* Icon */}
						<div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
							<svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</div>
						{/* Title */}
						<h2 className="text-xl font-bold text-zinc-900 dark:text-white text-center mb-2">
							Delete {selectedProducts.length} Product{selectedProducts.length !== 1 ? "s" : ""}?
						</h2>
						<p className="text-zinc-500 dark:text-zinc-400 text-sm text-center mb-1">
							This action <span className="font-semibold text-zinc-700 dark:text-zinc-300">cannot be undone</span>. The selected products and all their associated data will be permanently removed.
						</p>
						{/* Selected product names preview */}
						<div className="mt-3 mb-5 max-h-32 overflow-y-auto rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3">
							<ul className="space-y-1">
								{selectedProducts.map((id) => {
									const p = products.find((x) => x.id === id);
									return (
										<li key={id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
											<span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
											<span className="truncate">{p?.name ?? id}</span>
											{p?.sku && <span className="ml-auto text-xs text-zinc-400 font-mono flex-shrink-0">{p.sku}</span>}
										</li>
									);
								})}
							</ul>
						</div>
						{/* Error */}
						{deleteError && (
							<div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
								{deleteError}
							</div>
						)}
						{/* Actions */}
						<div className="flex gap-3">
							<button
								onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
								disabled={deleting}
								className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition-colors disabled:opacity-50">
								Cancel
							</button>
							<button
								onClick={handleBulkDelete}
								disabled={deleting}
								className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
								{deleting ? (
									<>
										<svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
										</svg>
										Deleting…
									</>
								) : (
									<>Delete {selectedProducts.length} Product{selectedProducts.length !== 1 ? "s" : ""}</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Products
					</h1>
					<div className="mt-1 space-y-1">
						{loading ? (
							<p className="text-zinc-500 text-sm">Loading products...</p>
						) : search || categoryFilter ? (
							<p className="text-zinc-500 text-sm">
								Showing {filteredProducts.length} of {totalProducts} products
							</p>
						) : (
							<p className="text-zinc-500 text-sm">
								{totalProducts} total products
							</p>
						)}
						{!loading && products.length < totalProducts && (
							<button
								onClick={() => setCurrentLimit((prev) => prev + 50)}
								className="text-blue-600 text-sm hover:text-blue-700 underline">
								Load more products
							</button>
						)}
					</div>
				</div>
				<Link
					href="/admin/products/new"
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
					Add Product
				</Link>
			</div>

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<input
						type="text"
						placeholder="Search products..."
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
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
						className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
						<option value="">All Categories</option>
						{categories.map((category) => (
							<option
								key={category.id}
								value={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</div>

				{selectedProducts.length > 0 && (
					<div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
						<span className="text-sm font-medium text-red-700 dark:text-red-400">
							{selectedProducts.length} selected
						</span>
						<button
							onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
							className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
							Delete Selected
						</button>
						<button
							onClick={() => setSelectedProducts([])}
							className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 ml-1 transition-colors">
							Clear
						</button>
					</div>
				)}
			</div>

			{/* Products Container */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
				{loading ? (
					<div className="p-12 text-center">
						<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
						<p className="text-sm text-zinc-500">Loading product catalog...</p>
					</div>
				) : filteredProducts.length === 0 ? (
					<div className="p-12 text-center">
						<div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
							<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
							</svg>
						</div>
						<p className="font-medium text-zinc-900 dark:text-white mb-1">No products found</p>
						<p className="text-sm text-zinc-500">
							{search || categoryFilter ? "Try adjusting your search or category filters" : "Start by adding your first product to the catalog"}
						</p>
					</div>
				) : (
					<>
						{/* Desktop Table View */}
						<div className="hidden md:block overflow-x-auto">
							<table className="w-full text-left">
								<thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
									<tr>
										<th className="w-12 px-4 py-3.5">
											<input
												type="checkbox"
												checked={
													selectedProducts.length === filteredProducts.length &&
													filteredProducts.length > 0
												}
												onChange={toggleSelectAll}
												className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
											/>
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Product
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											SKU
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Price
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Category
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Status
										</th>
										<th className="px-4 py-3.5 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
									{filteredProducts.map((product) => (
										<tr
											key={product.id}
											className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
											<td className="px-4 py-3.5">
												<input
													type="checkbox"
													checked={selectedProducts.includes(product.id)}
													onChange={() => toggleSelect(product.id)}
													className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
												/>
											</td>
											<td className="px-4 py-3.5">
												<div className="flex items-center gap-3">
													<div className="w-11 h-11 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-200/60 dark:border-zinc-700">
														{product.images?.[0] ? (
															<img
																src={product.images[0]}
																alt={product.name}
																className="w-full h-full object-cover"
															/>
														) : (
															<div className="w-full h-full flex items-center justify-center text-zinc-400">
																<svg
																	className="w-5 h-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24">
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={1.5}
																		d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
																	/>
																</svg>
															</div>
														)}
													</div>
													<div className="min-w-0">
														<div className="flex items-center gap-2">
															<Link
																href={`/admin/products/${product.id}`}
																className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 truncate max-w-xs block">
																{product.name}
															</Link>
															{product.is_featured && (
																<span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded shrink-0">
																	Featured
																</span>
															)}
														</div>
													</div>
												</div>
											</td>
											<td className="px-4 py-3.5 text-xs text-zinc-500 font-mono">
												{product.sku || "—"}
											</td>
											<td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-white">
												৳{Math.round(product.base_price).toLocaleString("en-BD")}
											</td>
											<td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
												{product.category?.name || "—"}
											</td>
											<td className="px-4 py-3.5">
												<span
													className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
														product.is_active
															? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
															: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
													}`}>
													<span
														className={`w-1.5 h-1.5 rounded-full ${
															product.is_active ? "bg-emerald-500" : "bg-zinc-400"
														}`}
													/>
													{product.is_active ? "Active" : "Draft"}
												</span>
											</td>
											<td className="px-4 py-3.5 text-right">
												<div className="flex items-center justify-end gap-1">
													<Link
														href={`/admin/products/${product.id}`}
														className="p-1.5 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
														title="Edit product">
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
													</Link>
													<Link
														href={`/product/${product.slug || product.id}`}
														target="_blank"
														rel="noopener noreferrer"
														className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
														title="View on storefront">
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
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Mobile Card List View */}
						<div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
							{filteredProducts.map((product) => (
								<div key={product.id} className="p-4 space-y-3">
									<div className="flex items-start gap-3">
										<input
											type="checkbox"
											checked={selectedProducts.includes(product.id)}
											onChange={() => toggleSelect(product.id)}
											className="w-4 h-4 mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
										/>
										<div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
											{product.images?.[0] ? (
												<img
													src={product.images[0]}
													alt={product.name}
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center text-zinc-400">
													<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
													</svg>
												</div>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5 flex-wrap mb-1">
												<Link
													href={`/admin/products/${product.id}`}
													className="font-medium text-zinc-900 dark:text-white text-sm hover:text-blue-600 line-clamp-1">
													{product.name}
												</Link>
												{product.is_featured && (
													<span className="px-1.5 py-0.2 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded">
														Featured
													</span>
												)}
											</div>
											<div className="flex items-center gap-2 text-xs text-zinc-500">
												<span className="font-mono">{product.sku || "No SKU"}</span>
												<span>•</span>
												<span>{product.category?.name || "Uncategorized"}</span>
											</div>
											<div className="mt-2 flex items-center justify-between">
												<span className="font-bold text-sm text-zinc-900 dark:text-white">
													৳{Math.round(product.base_price).toLocaleString("en-BD")}
												</span>
												<span
													className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
														product.is_active
															? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
															: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
													}`}>
													<span
														className={`w-1.5 h-1.5 rounded-full ${
															product.is_active ? "bg-emerald-500" : "bg-zinc-400"
														}`}
													/>
													{product.is_active ? "Active" : "Draft"}
												</span>
											</div>
										</div>
									</div>
									<div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
										<Link
											href={`/product/${product.slug || product.id}`}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
											<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
											</svg>
											View Store
										</Link>
										<Link
											href={`/admin/products/${product.id}`}
											className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
											<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
											Edit Product
										</Link>
									</div>
								</div>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
