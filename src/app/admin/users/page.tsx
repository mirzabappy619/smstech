"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, Shield, MapPin, Building2, Edit2, AlertCircle, RefreshCw, Globe } from "lucide-react";
import { useRBAC } from "@/lib/rbac/rbac-context";

interface BranchItem {
	id: string;
	name: string;
	code: string;
}

interface StaffUser {
	id: string;
	auth_id: string;
	email: string;
	full_name: string;
	phone: string | null;
	role: string;
	role_name: string;
	role_badge: string;
	is_active: boolean;
	is_all_branches: boolean;
	default_branch: BranchItem | null;
	assigned_branches: BranchItem[];
	assigned_branch_ids: string[];
	created_at: string;
}

export default function StaffUsersManagementPage() {
	const { isOwner } = useRBAC();
	const [staff, setStaff] = useState<StaffUser[]>([]);
	const [branches, setBranches] = useState<BranchItem[]>([]);
	const [roles, setRoles] = useState<{ key: string; name: string }[]>([]);
	const [loading, setLoading] = useState(true);
	const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

	// Modals
	const [showAddModal, setShowAddModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);

	// Form State
	const [formData, setFormData] = useState({
		email: "",
		password: "",
		full_name: "",
		phone: "",
		role: "cashier",
		is_all_branches: false,
		default_branch_id: "",
		assigned_branch_ids: [] as string[],
	});
	const [submitting, setSubmitting] = useState(false);

	const fetchData = async () => {
		try {
			setLoading(true);
			const [staffRes, rolesRes] = await Promise.all([
				fetch("/api/v1/admin/staff"),
				fetch("/api/v1/admin/roles"),
			]);

			const staffData = await staffRes.json();
			const rolesData = await rolesRes.json();

			if (staffData.success) {
				setStaff(staffData.data.staff || []);
				setBranches(staffData.data.branches || []);
			}

			if (rolesData.success && rolesData.data?.roles) {
				setRoles(rolesData.data.roles.map((r: any) => ({ key: r.key, name: r.name })));
			}
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to load staff list" });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	const openAddModal = () => {
		const firstBranch = branches[0]?.id || "";
		setFormData({
			email: "",
			password: "",
			full_name: "",
			phone: "",
			role: "cashier",
			is_all_branches: false,
			default_branch_id: firstBranch,
			assigned_branch_ids: firstBranch ? [firstBranch] : [],
		});
		setShowAddModal(true);
		setFeedback(null);
	};

	const openEditModal = (user: StaffUser) => {
		setSelectedStaff(user);
		setFormData({
			email: user.email,
			password: "",
			full_name: user.full_name,
			phone: user.phone || "",
			role: user.role,
			is_all_branches: user.is_all_branches,
			default_branch_id: user.default_branch?.id || branches[0]?.id || "",
			assigned_branch_ids: user.assigned_branch_ids || [],
		});
		setShowEditModal(true);
		setFeedback(null);
	};

	const toggleBranchSelection = (branchId: string) => {
		const current = new Set(formData.assigned_branch_ids);
		if (current.has(branchId)) {
			current.delete(branchId);
		} else {
			current.add(branchId);
		}
		const updated = Array.from(current);
		setFormData((prev) => ({
			...prev,
			assigned_branch_ids: updated,
			default_branch_id: updated.includes(prev.default_branch_id) ? prev.default_branch_id : updated[0] || "",
		}));
	};

	const handleCreateStaff = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setSubmitting(true);
			setFeedback(null);

			const res = await fetch("/api/v1/admin/staff", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to create staff member");
			}

			setShowAddModal(false);
			setFeedback({ type: "success", message: `Staff account ${formData.email} created successfully!` });
			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to create staff" });
		} finally {
			setSubmitting(false);
		}
	};

	const handleUpdateStaff = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedStaff) return;

		try {
			setSubmitting(true);
			setFeedback(null);

			const payload: any = {
				full_name: formData.full_name,
				phone: formData.phone || null,
				role: formData.role,
				is_all_branches: formData.is_all_branches,
				default_branch_id: formData.default_branch_id || null,
				assigned_branch_ids: formData.is_all_branches ? branches.map((b) => b.id) : formData.assigned_branch_ids,
			};

			if (formData.password) {
				payload.password = formData.password;
			}

			const res = await fetch(`/api/v1/admin/staff/${selectedStaff.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to update staff member");
			}

			setShowEditModal(false);
			setFeedback({ type: "success", message: "Staff permissions updated successfully!" });
			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to update staff" });
		} finally {
			setSubmitting(false);
		}
	};

	const handleToggleStatus = async (user: StaffUser) => {
		try {
			const res = await fetch(`/api/v1/admin/staff/${user.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ is_active: !user.is_active }),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to update status");
			}

			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to toggle status" });
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-7xl mx-auto">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
						<Users className="w-6 h-6 text-blue-600" />
						Staff & Branch Access Management
					</h1>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
						Manage internal store personnel, assign administrative roles, and scope branch-level permissions
					</p>
				</div>
				{isOwner && (
					<button
						type="button"
						onClick={openAddModal}
						className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer">
						<Plus className="w-4 h-4" />
						Add Staff Member
					</button>
				)}
			</div>

			{/* Alert Feedback */}
			{feedback && (
				<div
					className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
						feedback.type === "success"
							? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
							: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
					}`}>
					<AlertCircle className="w-5 h-5 shrink-0" />
					<p className="font-medium">{feedback.message}</p>
				</div>
			)}

			{/* Staff Table */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
							<tr>
								<th className="px-6 py-3.5">Staff Member</th>
								<th className="px-6 py-3.5">Role</th>
								<th className="px-6 py-3.5">Branch Permissions</th>
								<th className="px-6 py-3.5">Primary Branch</th>
								<th className="px-6 py-3.5">Status</th>
								<th className="px-6 py-3.5 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
							{staff.map((user) => (
								<tr
									key={user.id}
									className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
									<td className="px-6 py-4">
										<div className="flex items-center gap-3">
											<div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
												{user.full_name?.[0] || user.email[0].toUpperCase()}
											</div>
											<div>
												<p className="font-semibold text-zinc-900 dark:text-white">
													{user.full_name}
												</p>
												<p className="text-xs text-zinc-500 dark:text-zinc-400">
													{user.email}
												</p>
												{user.phone && (
													<p className="text-[11px] text-zinc-400 font-mono">
														{user.phone}
													</p>
												)}
											</div>
										</div>
									</td>
									<td className="px-6 py-4">
										<span
											className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${user.role_badge}`}>
											<Shield className="w-3 h-3" />
											{user.role_name}
										</span>
									</td>
									<td className="px-6 py-4">
										{user.is_all_branches || user.role === "owner" ? (
											<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-medium">
												<Globe className="w-3.5 h-3.5" />
												All Branches (Global)
											</span>
										) : (
											<div className="flex flex-wrap gap-1.5 max-w-xs">
												{user.assigned_branches.length > 0 ? (
													user.assigned_branches.map((b) => (
														<span
															key={b.id}
															className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px]">
															<MapPin className="w-3 h-3 text-zinc-400" />
															{b.name}
														</span>
													))
												) : (
													<span className="text-xs text-zinc-400 italic">No branches assigned</span>
												)}
											</div>
										)}
									</td>
									<td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
										{user.default_branch ? user.default_branch.name : "—"}
									</td>
									<td className="px-6 py-4">
										<button
											type="button"
											onClick={() => isOwner && handleToggleStatus(user)}
											disabled={!isOwner || user.role === "owner"}
											className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
												user.is_active
													? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
													: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
											} ${isOwner && user.role !== "owner" ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}>
											{user.is_active ? "Active" : "Inactive"}
										</button>
									</td>
									<td className="px-6 py-4 text-right">
										{isOwner && (
											<button
												type="button"
												onClick={() => openEditModal(user)}
												className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer">
												<Edit2 className="w-3.5 h-3.5" />
												Edit Access
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Add / Edit Staff Modal */}
			{(showAddModal || showEditModal) && (
				<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
						<div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
							<h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
								<Building2 className="w-5 h-5 text-blue-600" />
								{showAddModal ? "Add New Staff Member" : `Edit Permissions for ${selectedStaff?.full_name}`}
							</h3>
							<button
								type="button"
								onClick={() => {
									setShowAddModal(false);
									setShowEditModal(false);
								}}
								className="text-zinc-400 hover:text-zinc-600">
								✕
							</button>
						</div>

						<form
							onSubmit={showAddModal ? handleCreateStaff : handleUpdateStaff}
							className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
										Full Name *
									</label>
									<input
										type="text"
										required
										value={formData.full_name}
										onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
										placeholder="e.g. Tanvir Ahmed"
										className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
										Email Address *
									</label>
									<input
										type="email"
										required
										disabled={showEditModal}
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										placeholder="tanvir@smstechbd.com"
										className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-60"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
										{showAddModal ? "Initial Password *" : "Change Password (optional)"}
									</label>
									<input
										type="password"
										required={showAddModal}
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										placeholder={showAddModal ? "Min 6 characters" : "Leave blank to keep current"}
										className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>
								<div>
									<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
										Phone Number
									</label>
									<input
										type="text"
										value={formData.phone}
										onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
										placeholder="017XXXXXXXX"
										className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>
							</div>

							{/* Role Selection */}
							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
									Assigned Role *
								</label>
								<select
									value={formData.role}
									onChange={(e) => setFormData({ ...formData, role: e.target.value })}
									className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
									{roles.map((r) => (
										<option key={r.key} value={r.key}>
											{r.name} ({r.key})
										</option>
									))}
								</select>
							</div>

							{/* Branch Scoping */}
							<div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
											Branch Permission Scoping
										</h4>
										<p className="text-[11px] text-zinc-500">
											Select which branches this user can access in POS, inventory, and transfers
										</p>
									</div>
								</div>

								{/* All Branches Toggle */}
								<div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<Globe className="w-4 h-4 text-blue-600 shrink-0" />
										<div>
											<p className="text-xs font-semibold text-zinc-900 dark:text-white">
												Grant Access to All Branches (Global)
											</p>
											<p className="text-[11px] text-zinc-500">
												User can switch between all physical branches and main warehouse
											</p>
										</div>
									</div>
									<input
										type="checkbox"
										checked={formData.is_all_branches || formData.role === "owner"}
										disabled={formData.role === "owner"}
										onChange={(e) =>
											setFormData({ ...formData, is_all_branches: e.target.checked })
										}
										className="w-4 h-4 text-blue-600 rounded border-zinc-300 cursor-pointer"
									/>
								</div>

								{/* Specific Branches Checkbox List */}
								{!formData.is_all_branches && formData.role !== "owner" && (
									<div className="space-y-2 pt-1">
										<p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
											Or select specific branches:
										</p>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
											{branches.map((b) => {
												const isChecked = formData.assigned_branch_ids.includes(b.id);
												return (
													<div
														key={b.id}
														onClick={() => toggleBranchSelection(b.id)}
														className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
															isChecked
																? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-zinc-900 dark:text-white font-medium"
																: "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
														}`}>
														<div className="flex items-center gap-2 truncate">
															<MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
															<span className="truncate">{b.name}</span>
														</div>
														<input
															type="checkbox"
															checked={isChecked}
															onChange={() => {}}
															className="w-4 h-4 text-blue-600 rounded pointer-events-none"
														/>
													</div>
												);
											})}
										</div>
									</div>
								)}

								{/* Default Branch Selection */}
								<div className="pt-2">
									<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
										Default / Home Branch
									</label>
									<select
										value={formData.default_branch_id}
										onChange={(e) => setFormData({ ...formData, default_branch_id: e.target.value })}
										className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										{branches.map((b) => (
											<option key={b.id} value={b.id}>
												{b.name} ({b.code})
											</option>
										))}
									</select>
								</div>
							</div>

							<div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
								<button
									type="button"
									onClick={() => {
										setShowAddModal(false);
										setShowEditModal(false);
									}}
									className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
									Cancel
								</button>
								<button
									type="submit"
									disabled={submitting || !formData.email || !formData.full_name}
									className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
									{submitting
										? "Saving..."
										: showAddModal
										? "Create Staff Account"
										: "Update Permissions"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
