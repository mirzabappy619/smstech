"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRBAC } from "@/lib/rbac/rbac-context";
import { formatBDT } from "@/lib/currency";

interface ApprovalAction {
	id: string;
	step_order: number;
	action: "approved" | "rejected";
	acted_by_role: string | null;
	comment: string | null;
	created_at: string;
}

interface CashCloseApproval {
	id: string;
	request_number: string;
	shift_id: string;
	warehouse_id: string;
	closing_cash_expected: number;
	closing_cash_actual: number;
	difference: number;
	submitted_at: string;
	current_step: number;
	status: "pending" | "approved" | "rejected";
	rejection_reason: string | null;
	notes: string | null;
	can_act: boolean;
	warehouses: { id: string; name: string; code: string } | null;
	pos_shifts: {
		id: string;
		shift_number: string;
		opening_float: number;
		cash_sales_total: number;
		dues_collected_total: number;
		opened_at: string;
		closed_at: string | null;
	} | null;
	pipeline: { id: string; name: string } | null;
	current_node: {
		id: string;
		step_order: number;
		name: string;
		approver_role: string | null;
	} | null;
	actions: ApprovalAction[];
}

const fmt = (n: number) => formatBDT(n);

const STATUS_STYLES: Record<string, string> = {
	pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
	rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function ApprovalsPage() {
	const { hasPermission, activeBranch } = useRBAC();
	const [approvals, setApprovals] = useState<CashCloseApproval[]>([]);
	const [loading, setLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState("pending");
	const [expanded, setExpanded] = useState<string | null>(null);
	const [acting, setActing] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);
	const [rejectReason, setRejectReason] = useState("");
	const [error, setError] = useState("");

	const canManagePipelines = hasPermission("approvals:manage");

	const fetchApprovals = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const params = new URLSearchParams({ status: statusFilter });
			if (activeBranch) params.set("warehouse_id", activeBranch.id);

			const res = await fetch(`/api/v1/admin/approvals?${params}`);
			const json = await res.json();
			if (json.success) {
				setApprovals(json.data || []);
			} else {
				setError(json.error || "Failed to load the approval queue.");
			}
		} catch {
			setError("Failed to load the approval queue.");
		} finally {
			setLoading(false);
		}
	}, [statusFilter, activeBranch]);

	useEffect(() => {
		fetchApprovals();
	}, [fetchApprovals]);

	const act = async (
		approvalId: string,
		action: "approve" | "reject",
		comment?: string,
	) => {
		setActing(approvalId);
		try {
			const res = await fetch("/api/v1/admin/approvals", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ approval_id: approvalId, action, comment }),
			});
			const json = await res.json();
			if (json.success) {
				setRejectingId(null);
				setRejectReason("");
				await fetchApprovals();
			} else {
				setError(json.error || "That action could not be completed.");
			}
		} catch {
			setError("That action could not be completed.");
		} finally {
			setActing(null);
		}
	};

	const pendingCount = approvals.filter((a) => a.status === "pending").length;
	const actionableCount = approvals.filter((a) => a.can_act).length;

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
						Cash Close Approvals
					</h1>
					<p className="text-sm text-zinc-500 mt-1">
						Every POS drawer count walks its branch&rsquo;s approval chain before the
						shift is finally closed.
						{activeBranch
							? ` Showing ${activeBranch.name}.`
							: " Showing all branches you have access to."}
					</p>
				</div>

				{canManagePipelines && (
					<Link
						href="/admin/approvals/pipelines"
						className="px-4 py-2 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-xl text-xs font-black shadow-sm text-center">
						⚙ Configure Pipelines
					</Link>
				)}
			</div>

			{error && (
				<div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
					{error}
				</div>
			)}

			{/* KPIs */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<p className="text-xs font-medium text-zinc-500">In the queue</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{pendingCount}
					</p>
				</div>
				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<p className="text-xs font-medium text-zinc-500">Waiting on you</p>
					<p className="text-2xl font-black text-blue-600 mt-1">{actionableCount}</p>
				</div>
				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl col-span-2 sm:col-span-1">
					<p className="text-xs font-medium text-zinc-500">Total variance shown</p>
					<p
						className={`text-2xl font-black mt-1 ${
							approvals.reduce((s, a) => s + Number(a.difference), 0) === 0
								? "text-zinc-900 dark:text-white"
								: "text-amber-600"
						}`}>
						{fmt(approvals.reduce((s, a) => s + Number(a.difference), 0))}
					</p>
				</div>
			</div>

			{/* Filter */}
			<div className="flex gap-2 flex-wrap">
				{["pending", "approved", "rejected", "all"].map((s) => (
					<button
						key={s}
						onClick={() => setStatusFilter(s)}
						className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
							statusFilter === s
								? "bg-blue-600 text-white"
								: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
						}`}>
						{s}
					</button>
				))}
			</div>

			{loading ? (
				<div className="p-12 text-center text-xs text-zinc-400">
					Loading approval queue...
				</div>
			) : approvals.length === 0 ? (
				<div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<p className="text-3xl mb-2">✓</p>
					<p className="text-sm font-bold text-zinc-900 dark:text-white">
						Nothing {statusFilter === "all" ? "here" : statusFilter}
					</p>
					<p className="text-xs text-zinc-500 mt-1">
						Cash closes submitted from the POS terminal will appear here.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{approvals.map((a) => {
						const isOpen = expanded === a.id;
						const variance = Number(a.difference);
						return (
							<div
								key={a.id}
								className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
								<button
									onClick={() => setExpanded(isOpen ? null : a.id)}
									className="w-full p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
												{a.request_number}
											</span>
											<span
												className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[a.status]}`}>
												{a.status}
											</span>
											{a.can_act && (
												<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
													Your action
												</span>
											)}
										</div>
										<p className="text-xs text-zinc-500 mt-1">
											{a.warehouses?.name} · Shift {a.pos_shifts?.shift_number} ·{" "}
											{new Date(a.submitted_at).toLocaleString("en-GB")}
										</p>
										{a.status === "pending" && a.current_node && (
											<p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
												Step {a.current_step}: awaiting {a.current_node.name}
											</p>
										)}
									</div>

									<div className="text-right shrink-0">
										<p className="text-xs text-zinc-500">Variance</p>
										<p
											className={`text-lg font-black ${
												Math.abs(variance) < 0.01
													? "text-emerald-600"
													: variance > 0
														? "text-blue-600"
														: "text-rose-600"
											}`}>
											{Math.abs(variance) < 0.01 ? "Balanced" : fmt(variance)}
										</p>
									</div>
								</button>

								{isOpen && (
									<div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
										{/* Drawer figures */}
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
											<Figure label="Opening Float" value={fmt(a.pos_shifts?.opening_float || 0)} />
											<Figure label="Cash Sales" value={fmt(a.pos_shifts?.cash_sales_total || 0)} />
											<Figure label="Expected" value={fmt(a.closing_cash_expected)} />
											<Figure label="Counted" value={fmt(a.closing_cash_actual)} />
										</div>

										{a.notes && (
											<p className="text-xs text-zinc-500 italic">
												Cashier note: {a.notes}
											</p>
										)}

										{/* Chain history */}
										<div>
											<p className="text-[10px] uppercase tracking-wide font-bold text-zinc-400 mb-2">
												Approval trail — {a.pipeline?.name || "pipeline removed"}
											</p>
											{a.actions.length === 0 ? (
												<p className="text-xs text-zinc-400">
													No steps actioned yet.
												</p>
											) : (
												<ol className="space-y-1.5">
													{a.actions.map((act_) => (
														<li
															key={act_.id}
															className="flex items-start gap-2 text-xs">
															<span
																className={
																	act_.action === "approved"
																		? "text-emerald-600"
																		: "text-rose-600"
																}>
																{act_.action === "approved" ? "✓" : "✕"}
															</span>
															<div>
																<span className="font-semibold text-zinc-700 dark:text-zinc-300">
																	Step {act_.step_order} {act_.action}
																</span>
																<span className="text-zinc-400">
																	{" "}
																	by {act_.acted_by_role || "unknown role"} ·{" "}
																	{new Date(act_.created_at).toLocaleString("en-GB")}
																</span>
																{act_.comment && (
																	<p className="text-zinc-500 italic">
																		&ldquo;{act_.comment}&rdquo;
																	</p>
																)}
															</div>
														</li>
													))}
												</ol>
											)}
										</div>

										{a.status === "rejected" && a.rejection_reason && (
											<div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
												<span className="font-bold">Rejected:</span>{" "}
												{a.rejection_reason}
												<p className="mt-1 text-rose-600/80">
													The branch can recount the drawer and submit the close
													again from the POS terminal.
												</p>
											</div>
										)}

										{/* Actions */}
										{a.can_act && (
											<div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
												{rejectingId === a.id ? (
													<div className="space-y-2">
														<label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400">
															Why is this being rejected?
														</label>
														<textarea
															value={rejectReason}
															onChange={(e) => setRejectReason(e.target.value)}
															rows={2}
															placeholder="e.g. Counted total does not match the drop slips"
															className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
														/>
														<div className="flex gap-2">
															<button
																onClick={() => {
																	setRejectingId(null);
																	setRejectReason("");
																}}
																className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400">
																Cancel
															</button>
															<button
																disabled={!rejectReason.trim() || acting === a.id}
																onClick={() => act(a.id, "reject", rejectReason)}
																className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold">
																Confirm Rejection
															</button>
														</div>
													</div>
												) : (
													<div className="flex gap-2">
														<button
															disabled={acting === a.id}
															onClick={() => setRejectingId(a.id)}
															className="flex-1 py-2 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40">
															Reject
														</button>
														<button
															disabled={acting === a.id}
															onClick={() => act(a.id, "approve")}
															className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold">
															{acting === a.id
																? "Working..."
																: `Approve Step ${a.current_step}`}
														</button>
													</div>
												)}
											</div>
										)}

										{!a.can_act && a.status === "pending" && (
											<p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
												You are not an approver for the step this request is on.
											</p>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function Figure({ label, value }: { label: string; value: string }) {
	return (
		<div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60">
			<p className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">
				{label}
			</p>
			<p className="font-bold text-zinc-900 dark:text-white mt-0.5">{value}</p>
		</div>
	);
}
