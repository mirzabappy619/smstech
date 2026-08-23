"use client";

import { useState, useRef, useEffect } from "react";
import { useRBAC } from "@/lib/rbac/rbac-context";
import { MapPin, ChevronDown, Check, Building2, Globe } from "lucide-react";

export function BranchSwitcher() {
	const { branchContext, activeBranch, setActiveBranch, isOwner } = useRBAC();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const branches = branchContext.branches;
	const isMultiBranch = isOwner || branchContext.isAllBranches || branches.length > 1;

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	if (branches.length === 0) {
		return null;
	}

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => isMultiBranch && setIsOpen(!isOpen)}
				disabled={!isMultiBranch}
				className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
					isMultiBranch
						? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-100 cursor-pointer shadow-xs"
						: "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 cursor-default"
				}`}
				title={isMultiBranch ? "Click to switch branch" : "Assigned Branch"}>
				<div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
					{activeBranch ? (
						<MapPin className="w-3.5 h-3.5" />
					) : (
						<Globe className="w-3.5 h-3.5" />
					)}
				</div>
				<div className="flex flex-col text-left">
					<span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 leading-tight">
						Branch
					</span>
					<span className="font-semibold text-xs truncate max-w-[130px] sm:max-w-[170px] leading-tight">
						{activeBranch ? activeBranch.name : "All Branches (Global)"}
					</span>
				</div>
				{isMultiBranch && (
					<ChevronDown
						className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
							isOpen ? "rotate-180" : ""
						}`}
					/>
				)}
			</button>

			{isOpen && isMultiBranch && (
				<div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
					<div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
						<p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
							Select Active Branch
						</p>
						<p className="text-[11px] text-zinc-500 dark:text-zinc-400">
							POS, stock counts, and orders will scope to this branch
						</p>
					</div>

					<div className="max-h-60 overflow-y-auto py-1">
						{/* Option for Owner to view All Branches */}
						{(isOwner || branchContext.isAllBranches) && (
							<button
								type="button"
								onClick={() => {
									setActiveBranch(null);
									setIsOpen(false);
								}}
								className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
									activeBranch === null
										? "bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
										: "text-zinc-700 dark:text-zinc-300"
								}`}>
								<div className="flex items-center gap-2.5">
									<Globe className="w-4 h-4 text-blue-500" />
									<div>
										<p className="font-semibold text-xs">All Branches (Consolidated)</p>
										<p className="text-[10px] text-zinc-400">Show aggregate data across all stores</p>
									</div>
								</div>
								{activeBranch === null && <Check className="w-4 h-4 text-blue-600" />}
							</button>
						)}

						{branches.map((branch) => {
							const isSelected = activeBranch?.id === branch.id;
							return (
								<button
									key={branch.id}
									type="button"
									onClick={() => {
										setActiveBranch(branch);
										setIsOpen(false);
									}}
									className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
										isSelected
											? "bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium"
											: "text-zinc-700 dark:text-zinc-300"
									}`}>
									<div className="flex items-start gap-2.5">
										<Building2 className="w-4 h-4 text-zinc-400 mt-0.5" />
										<div className="truncate">
											<div className="flex items-center gap-1.5">
												<span className="font-semibold text-xs">{branch.name}</span>
												<span className="text-[9px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-mono">
													{branch.code}
												</span>
											</div>
											{branch.address && (
												<p className="text-[10px] text-zinc-400 truncate max-w-[190px]">
													{branch.address}
												</p>
											)}
										</div>
									</div>
									{isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
