"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { notify } from "@/components/ui/toast";

interface LandingPage {
	id: string;
	title: string;
	slug: string;
	status: "draft" | "published";
	view_count: number;
	conversion_count: number;
	created_at: string;
	updated_at: string;
}

interface PaginationInfo {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

const statusColors = {
	draft:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	published:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default function AdminLandingPagesPage() {
	const [pages, setPages] = useState<LandingPage[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | "draft" | "published"
	>("all");
	const [page, setPage] = useState(1);
	const [pagination, setPagination] = useState<PaginationInfo>({
		total: 0,
		page: 1,
		limit: 10,
		totalPages: 1,
	});
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
		null,
	);
	const [showUnpublishConfirm, setShowUnpublishConfirm] = useState<
		string | null
	>(null);
	const [processingAction, setProcessingAction] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [createFormData, setCreateFormData] = useState({
		title: "",
		slug: "",
		metaTitle: "",
		metaDescription: "",
	});
	const [creating, setCreating] = useState(false);
	const [slugError, setSlugError] = useState("");
	const [slugChecking, setSlugChecking] = useState(false);

	useEffect(() => {
		fetchPages();
	}, [page, search, statusFilter]);

	// Debounce slug checking
	useEffect(() => {
		if (!createFormData.slug || !showCreateModal) return;

		const timer = setTimeout(() => {
			checkSlug(createFormData.slug);
		}, 500);

		return () => clearTimeout(timer);
	}, [createFormData.slug, showCreateModal]);

	const fetchPages = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				page: page.toString(),
				limit: pagination.limit.toString(),
			});

			if (search) params.append("search", search);
			if (statusFilter !== "all") params.append("status", statusFilter);

			const response = await fetch(`/api/v1/admin/landing-pages?${params}`);
			const data = await response.json();

			console.log("Landing pages API response:", data);

			if (data.success) {
				console.log("Landing pages data:", data.data);
				setPages(data.data);
				if (data.meta) {
					setPagination(data.meta);
				}
			} else {
				console.error("Landing pages fetch failed:", data.error);
				notify.error("Failed to fetch landing pages");
			}
		} catch (err) {
			console.error("Failed to fetch landing pages:", err);
			notify.error("Failed to fetch landing pages");
		} finally {
			setLoading(false);
		}
	};

	const handleCopySlug = async (slug: string) => {
		try {
			await navigator.clipboard.writeText(slug);
			notify.success("Slug copied to clipboard");
		} catch (err) {
			notify.error("Failed to copy slug");
		}
	};

	const handleCopyURL = async (slug: string) => {
		try {
			const url = `${window.location.origin}/landing/${slug}`;
			await navigator.clipboard.writeText(url);
			notify.success("URL copied to clipboard");
		} catch (err) {
			notify.error("Failed to copy URL");
		}
	};

	const handlePublish = async (id: string) => {
		setProcessingAction(id);
		try {
			const response = await fetch(
				`/api/v1/admin/landing-pages/${id}/publish`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "published" }),
				},
			);
			const data = await response.json();

			if (data.success) {
				notify.success("Landing page published successfully");
				fetchPages();
			} else {
				notify.error(data.error || "Failed to publish");
			}
		} catch (err) {
			console.error("Failed to publish:", err);
			notify.error("Failed to publish landing page");
		} finally {
			setProcessingAction(null);
		}
	};

	const handleUnpublish = async (id: string) => {
		setProcessingAction(id);
		try {
			const response = await fetch(
				`/api/v1/admin/landing-pages/${id}/publish`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ status: "draft" }),
				},
			);
			const data = await response.json();

			if (data.success) {
				notify.success("Landing page unpublished");
				fetchPages();
			} else {
				notify.error(data.error || "Failed to unpublish");
			}
		} catch (err) {
			console.error("Failed to unpublish:", err);
			notify.error("Failed to unpublish landing page");
		} finally {
			setProcessingAction(null);
			setShowUnpublishConfirm(null);
		}
	};

	const handleDelete = async (id: string) => {
		setProcessingAction(id);
		try {
			const response = await fetch(`/api/v1/admin/landing-pages/${id}`, {
				method: "DELETE",
			});
			const data = await response.json();

			if (data.success) {
				notify.success("Landing page deleted successfully");
				// If we deleted the last item on the current page (and we're not on page 1),
				// go back one page so we don't fetch an empty page.
				const isLastOnPage = pages.length === 1 && page > 1;
				if (isLastOnPage) {
					setPage((p) => p - 1);
					// fetchPages will be triggered by the page state change via useEffect
				} else {
					fetchPages();
				}
			} else {
				notify.error(data.error || "Failed to delete");
			}
		} catch (err) {
			console.error("Failed to delete:", err);
			notify.error("Failed to delete landing page");
		} finally {
			setProcessingAction(null);
			setShowDeleteConfirm(null);
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const handleSearchChange = (value: string) => {
		setSearch(value);
		setPage(1); // Reset to first page on search
	};

	const handleStatusFilterChange = (value: "all" | "draft" | "published") => {
		setStatusFilter(value);
		setPage(1); // Reset to first page on filter
	};

	const generateSlug = (title: string) => {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	};

	const handleTitleChange = (title: string) => {
		setCreateFormData((prev) => ({
			...prev,
			title,
			slug: generateSlug(title),
		}));
		setSlugError("");
	};

	const handleSlugChange = (slug: string) => {
		const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
		setCreateFormData((prev) => ({ ...prev, slug: cleanSlug }));
		setSlugError("");
	};

	const checkSlug = async (slug: string) => {
		if (!slug) return;
		setSlugChecking(true);
		setSlugError("");
		try {
			const res = await fetch(`/api/v1/admin/landing-pages/check-slug/${slug}`);

			if (!res.ok) {
				console.error("Slug check failed with status:", res.status);
				setSlugError("Error checking slug availability");
				return;
			}

			const data = await res.json();
			console.log("Slug check response:", data);

			// Check the response format from the API
			if (data.success && data.data) {
				if (!data.data.available) {
					setSlugError("This slug is already taken");
				}
			} else {
				console.error("Unexpected slug check response:", data);
			}
		} catch (error) {
			console.error("Slug check error:", error);
			setSlugError("Error checking slug");
		} finally {
			setSlugChecking(false);
		}
	};

	const handleCreatePage = async () => {
		if (!createFormData.title || !createFormData.slug) {
			notify.error("Please fill in title and slug");
			return;
		}

		if (slugError) {
			notify.error("Please fix slug error");
			return;
		}

		setCreating(true);
		try {
			const res = await fetch("/api/v1/admin/landing-pages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: createFormData.title,
					slug: createFormData.slug,
					metaTitle: createFormData.metaTitle || createFormData.title,
					metaDescription: createFormData.metaDescription,
					blocks: [], // No blocks on initial creation
				}),
			});

			const response = await res.json();

			if (response.success) {
				notify.success("Page created successfully!");
				window.location.href = `/admin/landing-pages/builder?id=${response.data.id}`;
			} else {
				notify.error(response.error?.message || "Failed to create page");
			}
		} catch (error) {
			notify.error("Failed to create page");
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Landing Pages
					</h1>
					<p className="text-zinc-500 mt-1">
						{pagination.total} total landing pages
					</p>
				</div>
				<button
					onClick={() => setShowCreateModal(true)}
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
					Create New Page
				</button>
			</div>

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<input
						type="text"
						placeholder="Search by title or slug..."
						value={search}
						onChange={(e) => handleSearchChange(e.target.value)}
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
				<select
					value={statusFilter}
					onChange={(e) =>
						handleStatusFilterChange(
							e.target.value as "all" | "draft" | "published",
						)
					}
					className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
					<option value="all">All Status</option>
					<option value="draft">Draft</option>
					<option value="published">Published</option>
				</select>
			</div>

			{/* Landing Pages Table */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
				{loading ? (
					<div className="p-8 text-center">
						<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
					</div>
				) : pages.length === 0 ? (
					<div className="p-12 text-center">
						<svg
							className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<p className="text-zinc-500 text-lg mb-2">
							{search
								? "No landing pages match your search"
								: "No landing pages yet"}
						</p>
						{!search && (
							<p className="text-zinc-400 text-sm mb-4">
								Create your first landing page to get started
							</p>
						)}
						{!search && (
							<button
								onClick={() => setShowCreateModal(true)}
								className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
								Create New Page
							</button>
						)}
					</div>
				) : (
					<div className="relative">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-zinc-50 dark:bg-zinc-800/50">
									<tr>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Title
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Slug
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Status
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Views
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Conversions
										</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Created
										</th>
										<th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
									{pages.map((landingPage) => (
										<tr
											key={landingPage.id}
											className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
											<td className="px-4 py-4">
												<Link
													href={`/admin/landing-pages/builder?id=${landingPage.id}`}
													className="font-medium text-zinc-900 dark:text-white hover:text-blue-600">
													{landingPage.title}
												</Link>
											</td>
											<td className="px-4 py-4">
												<div className="flex items-center gap-2">
													<span className="text-sm text-zinc-500 font-mono">
														{landingPage.slug}
													</span>
													<button
														onClick={() => handleCopySlug(landingPage.slug)}
														className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
														title="Copy slug">
														<svg
															className="w-4 h-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
															/>
														</svg>
													</button>
												</div>
											</td>
											<td className="px-4 py-4">
												<span
													className={`inline-flex px-2 py-1 text-xs rounded-full ${statusColors[landingPage.status]}`}>
													{landingPage.status.charAt(0).toUpperCase() +
														landingPage.status.slice(1)}
												</span>
											</td>
											<td className="px-4 py-4 text-sm text-zinc-900 dark:text-white">
												{(landingPage.view_count || 0).toLocaleString()}
											</td>
											<td className="px-4 py-4 text-sm text-zinc-900 dark:text-white">
												{(landingPage.conversion_count || 0).toLocaleString()}
											</td>
											<td className="px-4 py-4 text-sm text-zinc-500">
												{formatDate(landingPage.created_at)}
											</td>
											<td className="px-4 py-4">
												<div className="flex items-center justify-end gap-2">
													{processingAction === landingPage.id ? (
														<div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
													) : (
														<>
															<Link
																href={`/admin/landing-pages/builder?id=${landingPage.id}`}
																className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
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
															</Link>
															<a
																href={`/landing/${landingPage.slug}${landingPage.status === "draft" ? "?preview=true" : ""}`}
																target="_blank"
																rel="noopener noreferrer"
																className="p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded"
																title="Preview">
																<svg
																	className="w-4 h-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24">
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
																	/>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
																	/>
																</svg>
															</a>
															{landingPage.status === "draft" ? (
																<button
																	onClick={() => handlePublish(landingPage.id)}
																	className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
																	title="Publish">
																	<svg
																		className="w-4 h-4"
																		fill="none"
																		stroke="currentColor"
																		viewBox="0 0 24 24">
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			strokeWidth={2}
																			d="M5 13l4 4L19 7"
																		/>
																	</svg>
																</button>
															) : (
																<button
																	onClick={() =>
																		setShowUnpublishConfirm(landingPage.id)
																	}
																	className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
																	title="Unpublish">
																	<svg
																		className="w-4 h-4"
																		fill="none"
																		stroke="currentColor"
																		viewBox="0 0 24 24">
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			strokeWidth={2}
																			d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
																		/>
																	</svg>
																</button>
															)}
															<button
																onClick={() => handleCopyURL(landingPage.slug)}
																className="p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded"
																title="Copy URL">
																<svg
																	className="w-4 h-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24">
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
																	/>
																</svg>
															</button>
															<button
																onClick={() =>
																	setShowDeleteConfirm(landingPage.id)
																}
																className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
														</>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>

			{/* Pagination */}
			{!loading && pages.length > 0 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-zinc-500">
						Showing page {pagination.page} of {pagination.totalPages} (
						{pagination.total} total)
					</p>
					<div className="flex gap-2">
						<button
							onClick={() => setPage(page - 1)}
							disabled={page === 1}
							className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 dark:text-white">
							Previous
						</button>
						<button
							onClick={() => setPage(page + 1)}
							disabled={page >= pagination.totalPages}
							className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 dark:text-white">
							Next
						</button>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6">
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
								<svg
									className="w-6 h-6 text-red-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Delete Landing Page
							</h3>
						</div>
						<p className="text-zinc-600 dark:text-zinc-400 mb-6">
							Are you sure you want to delete this landing page? This action
							cannot be undone.
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => setShowDeleteConfirm(null)}
								className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white">
								Cancel
							</button>
							<button
								onClick={() => handleDelete(showDeleteConfirm)}
								disabled={processingAction === showDeleteConfirm}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
								{processingAction === showDeleteConfirm
									? "Deleting..."
									: "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Unpublish Confirmation Modal */}
			{showUnpublishConfirm && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6">
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
								<svg
									className="w-6 h-6 text-yellow-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Unpublish Landing Page
							</h3>
						</div>
						<p className="text-zinc-600 dark:text-zinc-400 mb-6">
							Are you sure you want to unpublish this landing page? It will no
							longer be accessible to visitors.
						</p>
						<div className="flex gap-3 justify-end">
							<button
								onClick={() => setShowUnpublishConfirm(null)}
								className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white">
								Cancel
							</button>
							<button
								onClick={() => handleUnpublish(showUnpublishConfirm)}
								disabled={processingAction === showUnpublishConfirm}
								className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">
								{processingAction === showUnpublishConfirm
									? "Unpublishing..."
									: "Unpublish"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Create Landing Page Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between mb-6">
							<h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
								Create New Landing Page
							</h3>
							<button
								onClick={() => {
									setShowCreateModal(false);
									setCreateFormData({
										title: "",
										slug: "",
										metaTitle: "",
										metaDescription: "",
									});
									setSlugError("");
								}}
								className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						<div className="space-y-4">
							{/* Title */}
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Page Title <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={createFormData.title}
									onChange={(e) => handleTitleChange(e.target.value)}
									placeholder="My Awesome Landing Page"
									className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
							</div>

							{/* Slug */}
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									URL Slug <span className="text-red-500">*</span>
								</label>
								<div className="flex items-start gap-2">
									<div className="flex-1">
										<input
											type="text"
											value={createFormData.slug}
											onChange={(e) => handleSlugChange(e.target.value)}
											onBlur={() => checkSlug(createFormData.slug)}
											placeholder="my-awesome-landing-page"
											className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ${
												slugError
													? "border-red-500"
													: "border-zinc-300 dark:border-zinc-700"
											}`}
										/>
										{slugError && (
											<p className="text-red-500 text-sm mt-1">{slugError}</p>
										)}
										{slugChecking && (
											<p className="text-zinc-500 text-sm mt-1">
												Checking availability...
											</p>
										)}
									</div>
								</div>
								<p className="text-zinc-500 text-xs mt-1">
									Will be accessible at: /landing/
									{createFormData.slug || "your-slug"}
								</p>
							</div>

							{/* Meta Title (Optional) */}
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Meta Title (Optional)
								</label>
								<input
									type="text"
									value={createFormData.metaTitle}
									onChange={(e) =>
										setCreateFormData((prev) => ({
											...prev,
											metaTitle: e.target.value,
										}))
									}
									placeholder="Defaults to page title"
									className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
								<p className="text-zinc-500 text-xs mt-1">
									For SEO. Leave blank to use page title.
								</p>
							</div>

							{/* Meta Description (Optional) */}
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Meta Description (Optional)
								</label>
								<textarea
									value={createFormData.metaDescription}
									onChange={(e) =>
										setCreateFormData((prev) => ({
											...prev,
											metaDescription: e.target.value,
										}))
									}
									placeholder="Brief description for search engines..."
									rows={3}
									className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
								<p className="text-zinc-500 text-xs mt-1">
									For SEO. Recommended length: 150-160 characters.
								</p>
							</div>
						</div>

						<div className="flex gap-3 justify-end mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
							<button
								onClick={() => {
									setShowCreateModal(false);
									setCreateFormData({
										title: "",
										slug: "",
										metaTitle: "",
										metaDescription: "",
									});
									setSlugError("");
								}}
								className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white">
								Cancel
							</button>
							<button
								onClick={handleCreatePage}
								disabled={
									creating ||
									!createFormData.title ||
									!createFormData.slug ||
									!!slugError ||
									slugChecking
								}
								className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
								{creating ? "Creating..." : "Create & Edit Content"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
