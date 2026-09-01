"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const OWNER_ROLE = "owner";

interface PipelineNode {
	id?: string;
	name: string;
	approver_role: string | null;
	approver_user_id: string | null;
	min_variance_abs: number;
}

interface Pipeline {
	id: string;
	name: string;
	description: string | null;
	warehouse_id: string | null;
	is_active: boolean;
	warehouses: { id: string; name: string; code: string } | null;
	nodes: PipelineNode[];
}

interface RoleOption {
	key: string;
	name: string;
	level: number;
}
interface UserOption {
	id: string;
	full_name: string | null;
	email: string;
	role: string;
}
interface WarehouseOption {
	id: string;
	name: string;
	code: string;
}

const blankNode = (): PipelineNode => ({
	name: "",
	approver_role: "branch_manager",
	approver_user_id: null,
	min_variance_abs: 0,
});

// The chain always terminates at the superadmin; the builder pins this step and
// will not let it be removed or reassigned.
const ownerNode = (): PipelineNode => ({
	name: "Superadmin Sign-off",
	approver_role: OWNER_ROLE,
	approver_user_id: null,
	min_variance_abs: 0,
});

export default function ApprovalPipelinesPage() {
	const [pipelines, setPipelines] = useState<Pipeline[]>([]);
	const [roles, setRoles] = useState<RoleOption[]>([]);
	const [users, setUsers] = useState<UserOption[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	// Editor state — null means the editor is closed.
	const [editing, setEditing] = useState<{
		id?: string;
		name: string;
		description: string;
		warehouse_id: string;
		is_active: boolean;
		nodes: PipelineNode[];
	} | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [pRes, aRes] = await Promise.all([
				fetch("/api/v1/admin/approvals/pipelines"),
				fetch("/api/v1/admin/approvals/approvers"),
			]);
			const pJson = await pRes.json();
			const aJson = await aRes.json();

			if (pJson.success) setPipelines(pJson.data || []);
			else setError(pJson.error || "Failed to load pipelines.");

			if (aJson.success) {
				setRoles(aJson.data.roles || []);
				setUsers(aJson.data.users || []);
				setWarehouses(aJson.data.warehouses || []);
			}
		} catch {
			setError("Failed to load pipelines.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const startNew = () => {
		setError("");
		setEditing({
			name: "",
			description: "",
			warehouse_id: "",
			is_active: true,
			nodes: [blankNode(), ownerNode()],
		});
	};

	const startEdit = (p: Pipeline) => {
		setError("");
		setEditing({
			id: p.id,
			name: p.name,
			description: p.description || "",
			warehouse_id: p.warehouse_id || "",
			is_active: p.is_active,
			nodes:
				p.nodes.length > 0
					? p.nodes.map((n) => ({
							name: n.name,
							approver_role: n.approver_role,
							approver_user_id: n.approver_user_id,
							min_variance_abs: Number(n.min_variance_abs) || 0,
						}))
					: [blankNode(), ownerNode()],
		});
	};

	const updateNode = (index: number, patch: Partial<PipelineNode>) => {
		if (!editing) return;
		const nodes = editing.nodes.map((n, i) => (i === index ? { ...n, ...patch } : n));
		setEditing({ ...editing, nodes });
	};

	const addNode = () => {
		if (!editing) return;
		// New steps land above the pinned owner step, never after it.
		const nodes = [...editing.nodes];
		nodes.splice(nodes.length - 1, 0, blankNode());
		setEditing({ ...editing, nodes });
	};

	const removeNode = (index: number) => {
		if (!editing) return;
		if (index === editing.nodes.length - 1) return; // owner step is fixed
		setEditing({
			...editing,
			nodes: editing.nodes.filter((_, i) => i !== index),
		});
	};

	const moveNode = (index: number, direction: -1 | 1) => {
		if (!editing) return;
		const target = index + direction;
		// Neither end may swap with the pinned owner step.
		if (target < 0 || target >= editing.nodes.length - 1) return;
		const nodes = [...editing.nodes];
		[nodes[index], nodes[target]] = [nodes[target], nodes[index]];
		setEditing({ ...editing, nodes });
	};

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		setError("");
		try {
			const res = await fetch("/api/v1/admin/approvals/pipelines", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: editing.id,
					name: editing.name,
					description: editing.description,
					warehouse_id: editing.warehouse_id || null,
					is_active: editing.is_active,
					nodes: editing.nodes.map((n, i) => ({
						name: n.name || `Step ${i + 1}`,
						approver_role: n.approver_role,
						approver_user_id: n.approver_user_id,
						min_variance_abs: n.min_variance_abs,
					})),
				}),
			});
			const json = await res.json();
			if (json.success) {
				setEditing(null);
				await load();
			} else {
				setError(json.error || "Could not save the pipeline.");
			}
		} catch {
			setError("Could not save the pipeline.");
		} finally {
			setSaving(false);
		}
	};

	const remove = async (id: string) => {
		if (!confirm("Delete this pipeline? Branches using it fall back to the global chain.")) {
			return;
		}
		setError("");
		const res = await fetch(`/api/v1/admin/approvals/pipelines?id=${id}`, {
			method: "DELETE",
		});
		const json = await res.json();
		if (json.success) await load();
		else setError(json.error || "Could not delete the pipeline.");
	};

	const input =
		"w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm";

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
						<Link href="/admin/approvals" className="hover:text-blue-600">
							Approvals
						</Link>
						<span>›</span>
						<span>Pipelines</span>
					</div>
					<h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
						Approval Pipelines
					</h1>
					<p className="text-sm text-zinc-500 mt-1">
						Chains a cash close walks before the shift closes. A branch uses its own
						chain if it has one, otherwise the global chain. Every chain ends at the
						superadmin.
					</p>
				</div>

				{!editing && (
					<button
						onClick={startNew}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30">
						+ New Pipeline
					</button>
				)}
			</div>

			{error && (
				<div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
					{error}
				</div>
			)}

			{/* ── Editor ───────────────────────────────────────────────────── */}
			{editing && (
				<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
					<h2 className="text-lg font-bold text-zinc-900 dark:text-white">
						{editing.id ? "Edit Pipeline" : "New Pipeline"}
					</h2>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
								Pipeline Name *
							</label>
							<input
								value={editing.name}
								onChange={(e) => setEditing({ ...editing, name: e.target.value })}
								placeholder="e.g. Dhaka Branch Cash Close"
								className={input}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
								Applies To
							</label>
							<select
								value={editing.warehouse_id}
								onChange={(e) =>
									setEditing({ ...editing, warehouse_id: e.target.value })
								}
								className={input}>
								<option value="">All branches (global fallback)</option>
								{warehouses.map((w) => (
									<option key={w.id} value={w.id}>
										{w.name} ({w.code})
									</option>
								))}
							</select>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
							Description
						</label>
						<input
							value={editing.description}
							onChange={(e) =>
								setEditing({ ...editing, description: e.target.value })
							}
							placeholder="What this chain is for"
							className={input}
						/>
					</div>

					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={editing.is_active}
							onChange={(e) =>
								setEditing({ ...editing, is_active: e.target.checked })
							}
							className="w-4 h-4 rounded border-zinc-300"
						/>
						<span className="text-sm text-zinc-900 dark:text-zinc-100">
							Active (inactive chains are not used to route new closes)
						</span>
					</label>

					{/* Steps */}
					<div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-sm font-bold text-zinc-900 dark:text-white">
									Approval Steps
								</h3>
								<p className="text-xs text-zinc-500">
									Requests move down the list in order. Add as many steps as you need.
								</p>
							</div>
							<button
								onClick={addNode}
								className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300">
								+ Add Step
							</button>
						</div>

						<div className="space-y-3">
							{editing.nodes.map((node, i) => {
								const isOwnerStep = i === editing.nodes.length - 1;
								return (
									<div
										key={i}
										className={`p-4 rounded-xl border ${
											isOwnerStep
												? "border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20"
												: "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40"
										}`}>
										<div className="flex items-center justify-between mb-3">
											<span className="text-xs font-black text-zinc-500">
												STEP {i + 1}
												{isOwnerStep && (
													<span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px]">
														FINAL · SUPERADMIN
													</span>
												)}
											</span>
											{!isOwnerStep && (
												<div className="flex gap-1">
													<button
														onClick={() => moveNode(i, -1)}
														disabled={i === 0}
														className="px-2 py-1 text-xs rounded bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 disabled:opacity-30">
														↑
													</button>
													<button
														onClick={() => moveNode(i, 1)}
														disabled={i >= editing.nodes.length - 2}
														className="px-2 py-1 text-xs rounded bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 disabled:opacity-30">
														↓
													</button>
													<button
														onClick={() => removeNode(i)}
														disabled={editing.nodes.length <= 2}
														className="px-2 py-1 text-xs rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900 disabled:opacity-30">
														Remove
													</button>
												</div>
											)}
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
											<div>
												<label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
													Step Label
												</label>
												<input
													value={node.name}
													onChange={(e) => updateNode(i, { name: e.target.value })}
													disabled={isOwnerStep}
													placeholder={`Step ${i + 1}`}
													className={`${input} disabled:opacity-60`}
												/>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
													Approver
												</label>
												<select
													value={
														node.approver_user_id
															? `user:${node.approver_user_id}`
															: `role:${node.approver_role}`
													}
													disabled={isOwnerStep}
													onChange={(e) => {
														const [kind, value] = e.target.value.split(":");
														updateNode(
															i,
															kind === "user"
																? { approver_user_id: value, approver_role: null }
																: { approver_role: value, approver_user_id: null },
														);
													}}
													className={`${input} disabled:opacity-60`}>
													<optgroup label="Any user with role">
														{roles
															.filter((r) => r.key !== OWNER_ROLE)
															.map((r) => (
																<option key={r.key} value={`role:${r.key}`}>
																	{r.name}
																</option>
															))}
														{isOwnerStep && (
															<option value={`role:${OWNER_ROLE}`}>
																Superadmin / Owner
															</option>
														)}
													</optgroup>
													<optgroup label="Specific person">
														{users.map((u) => (
															<option key={u.id} value={`user:${u.id}`}>
																{u.full_name || u.email} ({u.role})
															</option>
														))}
													</optgroup>
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
													Skip below variance (৳)
												</label>
												<input
													type="number"
													min="0"
													step="1"
													value={node.min_variance_abs}
													onChange={(e) =>
														updateNode(i, {
															min_variance_abs: Number(e.target.value) || 0,
														})
													}
													className={input}
												/>
											</div>
										</div>

										{node.min_variance_abs > 0 && (
											<p className="mt-2 text-[11px] text-zinc-500">
												Skipped when the drawer is within ৳
												{node.min_variance_abs.toLocaleString("en-BD")} of expected.
											</p>
										)}
									</div>
								);
							})}
						</div>
					</div>

					<div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
						<button
							onClick={() => setEditing(null)}
							className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400">
							Cancel
						</button>
						<button
							onClick={save}
							disabled={saving || !editing.name.trim()}
							className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-black">
							{saving ? "Saving..." : "Save Pipeline"}
						</button>
					</div>
				</div>
			)}

			{/* ── List ─────────────────────────────────────────────────────── */}
			{loading ? (
				<div className="p-12 text-center text-xs text-zinc-400">
					Loading pipelines...
				</div>
			) : (
				<div className="space-y-3">
					{pipelines.map((p) => (
						<div
							key={p.id}
							className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
							<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<h3 className="font-bold text-zinc-900 dark:text-white">
											{p.name}
										</h3>
										<span
											className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
												p.is_active
													? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
													: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
											}`}>
											{p.is_active ? "Active" : "Inactive"}
										</span>
										<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
											{p.warehouses
												? `${p.warehouses.name} only`
												: "All branches"}
										</span>
									</div>
									{p.description && (
										<p className="text-xs text-zinc-500 mt-1">{p.description}</p>
									)}
								</div>

								<div className="flex gap-2 shrink-0">
									<button
										onClick={() => startEdit(p)}
										className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300">
										Edit
									</button>
									<button
										onClick={() => remove(p.id)}
										className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg text-xs font-bold">
										Delete
									</button>
								</div>
							</div>

							{/* Chain preview */}
							<div className="mt-4 flex items-center gap-2 flex-wrap">
								{p.nodes.map((n, i) => {
									const person = users.find((u) => u.id === n.approver_user_id);
									const role = roles.find((r) => r.key === n.approver_role);
									return (
										<div key={i} className="flex items-center gap-2">
											<span
												className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
													n.approver_role === OWNER_ROLE
														? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
														: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
												}`}>
												{n.name}
												<span className="font-normal opacity-70">
													{" · "}
													{person
														? person.full_name || person.email
														: role?.name || n.approver_role}
												</span>
											</span>
											{i < p.nodes.length - 1 && (
												<span className="text-zinc-300 dark:text-zinc-600">→</span>
											)}
										</div>
									);
								})}
							</div>
						</div>
					))}

					{pipelines.length === 0 && (
						<div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
							<p className="text-sm font-bold text-zinc-900 dark:text-white">
								No pipelines configured
							</p>
							<p className="text-xs text-zinc-500 mt-1">
								Cash closes cannot be submitted until at least one chain exists.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
