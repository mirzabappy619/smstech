"use client";

import React, { useState, useEffect } from "react";
import { Shield, Plus, Lock, Save, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { useRBAC } from "@/lib/rbac/rbac-context";

interface PermissionItem {
	code: string;
	name: string;
	description: string;
	module: string;
}

interface PermissionModuleGroup {
	module: string;
	permissions: PermissionItem[];
}

interface RoleItem {
	id: string;
	key: string;
	name: string;
	description: string;
	is_system: boolean;
	badge_color: string;
	level: number;
	permissions: string[];
	user_count: number;
}

export default function RolesManagementPage() {
	const { isOwner } = useRBAC();
	const [roles, setRoles] = useState<RoleItem[]>([]);
	const [permissionModules, setPermissionModules] = useState<PermissionModuleGroup[]>([]);
	const [allCodes, setAllCodes] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
	const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

	// Create Role Modal
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newRoleKey, setNewRoleKey] = useState("");
	const [newRoleName, setNewRoleName] = useState("");
	const [newRoleDescription, setNewRoleDescription] = useState("");
	const [newRolePermissions, setNewRolePermissions] = useState<Set<string>>(new Set());
	const [creating, setCreating] = useState(false);

	const fetchData = async () => {
		try {
			setLoading(true);
			const [rolesRes, permsRes] = await Promise.all([
				fetch("/api/v1/admin/roles"),
				fetch("/api/v1/admin/permissions"),
			]);

			const rolesData = await rolesRes.json();
			const permsData = await permsRes.json();

			if (rolesData.success && rolesData.data?.roles) {
				setRoles(rolesData.data.roles);
				if (!selectedRole && rolesData.data.roles.length > 0) {
					const first = rolesData.data.roles[0];
					setSelectedRole(first);
					setSelectedPermissions(new Set(first.permissions || []));
				} else if (selectedRole) {
					const updated = rolesData.data.roles.find((r: RoleItem) => r.key === selectedRole.key);
					if (updated) {
						setSelectedRole(updated);
						setSelectedPermissions(new Set(updated.permissions || []));
					}
				}
			}

			if (permsData.success && permsData.data?.modules) {
				setPermissionModules(permsData.data.modules);
				setAllCodes(permsData.data.allCodes || []);
			}
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to load roles and permissions" });
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	const handleSelectRole = (role: RoleItem) => {
		setSelectedRole(role);
		setSelectedPermissions(new Set(role.permissions || []));
		setFeedback(null);
	};

	const togglePermission = (code: string) => {
		if (selectedRole?.key === "owner") return; // Owner always has all
		const updated = new Set(selectedPermissions);
		if (updated.has(code)) {
			updated.delete(code);
		} else {
			updated.add(code);
		}
		setSelectedPermissions(updated);
	};

	const toggleModule = (module: string) => {
		if (selectedRole?.key === "owner") return;
		const group = permissionModules.find((g) => g.module === module);
		if (!group) return;

		const updated = new Set(selectedPermissions);
		const allModuleSelected = group.permissions.every((p) => updated.has(p.code));

		if (allModuleSelected) {
			group.permissions.forEach((p) => updated.delete(p.code));
		} else {
			group.permissions.forEach((p) => updated.add(p.code));
		}
		setSelectedPermissions(updated);
	};

	const selectAllPermissions = () => {
		if (selectedRole?.key === "owner") return;
		setSelectedPermissions(new Set(allCodes));
	};

	const clearAllPermissions = () => {
		if (selectedRole?.key === "owner") return;
		setSelectedPermissions(new Set());
	};

	const handleSavePermissions = async () => {
		if (!selectedRole) return;
		try {
			setSaving(true);
			setFeedback(null);

			const res = await fetch(`/api/v1/admin/roles/${selectedRole.key}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					permissions: Array.from(selectedPermissions),
				}),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to update role permissions");
			}

			setFeedback({ type: "success", message: `Permissions for ${selectedRole.name} updated successfully!` });
			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to save permissions" });
		} finally {
			setSaving(false);
		}
	};

	const handleCreateRole = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setCreating(true);
			setFeedback(null);

			const formattedKey = newRoleKey.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");

			const res = await fetch("/api/v1/admin/roles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					key: formattedKey,
					name: newRoleName.trim(),
					description: newRoleDescription.trim(),
					permissions: Array.from(newRolePermissions),
				}),
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to create role");
			}

			setShowCreateModal(false);
			setNewRoleKey("");
			setNewRoleName("");
			setNewRoleDescription("");
			setNewRolePermissions(new Set());
			setFeedback({ type: "success", message: "New role created successfully!" });
			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to create role" });
		} finally {
			setCreating(false);
		}
	};

	const handleDeleteRole = async (roleKey: string) => {
		if (!confirm(`Are you sure you want to delete the role "${roleKey}"? This cannot be undone.`)) return;

		try {
			setSaving(true);
			const res = await fetch(`/api/v1/admin/roles/${roleKey}`, {
				method: "DELETE",
			});

			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to delete role");
			}

			setFeedback({ type: "success", message: "Role deleted successfully!" });
			setSelectedRole(null);
			await fetchData();
		} catch (err: any) {
			setFeedback({ type: "error", message: err.message || "Failed to delete role" });
		} finally {
			setSaving(false);
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
						<Shield className="w-6 h-6 text-blue-600" />
						Roles & Permissions Matrix
					</h1>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
						Define system roles, access levels, and granular permissions across all store modules
					</p>
				</div>
				{isOwner && (
					<button
						type="button"
						onClick={() => setShowCreateModal(true)}
						className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer">
						<Plus className="w-4 h-4" />
						Create Custom Role
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

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				{/* Left Sidebar: Roles List */}
				<div className="lg:col-span-4 space-y-3">
					<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
						<div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
								Available Roles ({roles.length})
							</span>
						</div>
						<div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
							{roles.map((role) => {
								const isSelected = selectedRole?.key === role.key;
								return (
									<button
										key={role.key}
										type="button"
										onClick={() => handleSelectRole(role)}
										className={`w-full p-4 text-left transition-colors flex items-start justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
											isSelected
												? "bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-600"
												: ""
										}`}>
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-sm text-zinc-900 dark:text-white">
													{role.name}
												</span>
												{role.is_system && (
													<span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded">
														System
													</span>
												)}
											</div>
											<p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
												{role.description}
											</p>
											<div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400">
												<span>
													<strong>{role.permissions?.length || 0}</strong> permissions
												</span>
												<span>•</span>
												<span>
													<strong>{role.user_count || 0}</strong> users
												</span>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				{/* Right Column: Permission Matrix */}
				<div className="lg:col-span-8 space-y-4">
					{selectedRole ? (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
							{/* Role Details Banner */}
							<div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div>
									<div className="flex items-center gap-2">
										<h2 className="text-lg font-bold text-zinc-900 dark:text-white">
											{selectedRole.name}
										</h2>
										<span className="font-mono text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded font-medium">
											{selectedRole.key}
										</span>
									</div>
									<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
										{selectedRole.description}
									</p>
								</div>

								{/* Action Buttons */}
								<div className="flex items-center gap-2 shrink-0">
									{!selectedRole.is_system && isOwner && (
										<button
											type="button"
											onClick={() => handleDeleteRole(selectedRole.key)}
											className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
											title="Delete Role">
											<Trash2 className="w-4 h-4" />
										</button>
									)}
									{isOwner && selectedRole.key !== "owner" && (
										<button
											type="button"
											onClick={handleSavePermissions}
											disabled={saving}
											className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50">
											<Save className="w-3.5 h-3.5" />
											{saving ? "Saving..." : "Save Permissions"}
										</button>
									)}
								</div>
							</div>

							{/* Quick Toggle Controls */}
							{selectedRole.key !== "owner" && (
								<div className="px-5 py-2.5 bg-zinc-100/60 dark:bg-zinc-800/20 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
									<span className="text-zinc-500">
										Selected: <strong>{selectedPermissions.size}</strong> of {allCodes.length} permissions
									</span>
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={selectAllPermissions}
											className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
											Select All
										</button>
										<span className="text-zinc-300">|</span>
										<button
											type="button"
											onClick={clearAllPermissions}
											className="text-red-600 dark:text-red-400 hover:underline font-medium">
											Clear All
										</button>
									</div>
								</div>
							)}

							{/* Permission Modules List */}
							<div className="p-5 space-y-6">
								{selectedRole.key === "owner" && (
									<div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center gap-3">
										<Lock className="w-5 h-5 text-purple-600 shrink-0" />
										<p className="text-xs text-purple-800 dark:text-purple-300">
											The <strong>Owner</strong> role possesses immutable unrestricted superadmin privileges across all modules, ledgers, and branches.
										</p>
									</div>
								)}

								{permissionModules.map((group) => {
									const isModuleAll = group.permissions.every((p) => selectedPermissions.has(p.code));

									return (
										<div
											key={group.module}
											className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
											<div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
												<div className="flex items-center gap-2">
													<input
														type="checkbox"
														id={`mod-${group.module}`}
														checked={isModuleAll || selectedRole.key === "owner"}
														disabled={selectedRole.key === "owner"}
														onChange={() => toggleModule(group.module)}
														className="w-4 h-4 text-blue-600 rounded border-zinc-300 dark:border-zinc-700"
													/>
													<label
														htmlFor={`mod-${group.module}`}
														className="font-bold text-xs uppercase tracking-wider text-zinc-800 dark:text-zinc-200 cursor-pointer">
														{group.module}
													</label>
												</div>
												<span className="text-[11px] text-zinc-400">
													{group.permissions.filter((p) => selectedPermissions.has(p.code)).length} / {group.permissions.length} active
												</span>
											</div>

											<div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white dark:bg-zinc-900">
												{group.permissions.map((perm) => {
													const isChecked = selectedPermissions.has(perm.code) || selectedRole.key === "owner";
													return (
														<div
															key={perm.code}
															onClick={() => togglePermission(perm.code)}
															className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-3 ${
																isChecked
																	? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 text-zinc-900 dark:text-white"
																	: "bg-zinc-50/30 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
															}`}>
															<input
																type="checkbox"
																checked={isChecked}
																disabled={selectedRole.key === "owner"}
																onChange={() => {}}
																className="mt-0.5 w-4 h-4 text-blue-600 rounded border-zinc-300 pointer-events-none shrink-0"
															/>
															<div className="space-y-0.5">
																<p className="text-xs font-semibold leading-tight">{perm.name}</p>
																<p className="text-[11px] text-zinc-400 leading-tight">{perm.description}</p>
																<p className="text-[9px] font-mono text-zinc-400 pt-0.5">{perm.code}</p>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-400">
							Select a role on the left to inspect and configure its permissions.
						</div>
					)}
				</div>
			</div>

			{/* Create Custom Role Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
						<div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
							<h3 className="text-base font-bold text-zinc-900 dark:text-white">Create Custom Role</h3>
							<button
								type="button"
								onClick={() => setShowCreateModal(false)}
								className="text-zinc-400 hover:text-zinc-600">
								✕
							</button>
						</div>
						<form onSubmit={handleCreateRole} className="p-5 space-y-4">
							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
									Role Name (Display)
								</label>
								<input
									type="text"
									required
									value={newRoleName}
									onChange={(e) => {
										setNewRoleName(e.target.value);
										if (!newRoleKey) {
											setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"));
										}
									}}
									placeholder="e.g. Senior Sales Executive"
									className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
									Role Key (Unique Identifier)
								</label>
								<input
									type="text"
									required
									value={newRoleKey}
									onChange={(e) => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
									placeholder="e.g. senior_sales"
									className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
									Description
								</label>
								<textarea
									value={newRoleDescription}
									onChange={(e) => setNewRoleDescription(e.target.value)}
									placeholder="What is this role responsible for?"
									rows={2}
									className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
							</div>

							<div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
								<button
									type="button"
									onClick={() => setShowCreateModal(false)}
									className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
									Cancel
								</button>
								<button
									type="submit"
									disabled={creating || !newRoleName || !newRoleKey}
									className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
									{creating ? "Creating..." : "Create Role"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
