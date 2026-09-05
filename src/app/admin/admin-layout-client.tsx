"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "@/presentation/components/ui/theme-switcher";
import { UserMenu } from "./user-menu";
import { BranchSwitcher } from "./branch-switcher";
import { useRBAC } from "@/lib/rbac/rbac-context";
import { isNavItemActive } from "@/lib/admin-nav";
import {
	Activity,
	ArrowLeft,
	ArrowLeftRight,
	BarChart3,
	BookOpen,
	Boxes,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Cpu,
	FolderTree,
	GitBranch,
	Layers,
	LayoutDashboard,
	LineChart,
	ClipboardList,
	Package,
	PackageCheck,
	PackagePlus,
	PanelLeftClose,
	PanelLeftOpen,
	QrCode,
	Receipt,
	Repeat,
	ScrollText,
	Search,
	Settings,
	Shield,
	ShieldAlert,
	ShieldCheck,
	ShoppingBag,
	ShoppingCart,
	SlidersHorizontal,
	Store,
	TicketPercent,
	Truck,
	UserCog,
	Users,
	Warehouse,
	X,
	type LucideIcon,
} from "lucide-react";

interface AdminLayoutClientProps {
	children: React.ReactNode;
	userName: string;
	userEmail: string;
	userRole: string;
	userInitials: string;
}

export interface NavItemDef {
	href: string;
	label: string;
	icon: LucideIcon;
	permission?: string;
	badge?: string;
	badgeVariant?: "emerald" | "blue" | "amber" | "purple";
	/**
	 * Sub-pages, listed under the entry when the route is inside it. Used where
	 * one feature area is several screens — procurement is five — and putting
	 * each at the top level would bury the rest of the group.
	 */
	children?: NavItemDef[];
}

export interface NavGroupDef {
	id: string;
	title: string;
	items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
	{
		id: "operations",
		title: "Daily Operations",
		items: [
			{
				href: "/admin/dashboard",
				label: "Dashboard",
				icon: LayoutDashboard,
				permission: "dashboard:view",
			},
			{
				href: "/admin/pos",
				label: "Shop POS Terminal",
				icon: Store,
				permission: "pos:access",
				badge: "Live",
				badgeVariant: "emerald",
			},
			{
				href: "/admin/pos/orders",
				label: "POS Sales",
				icon: Receipt,
				permission: "orders:view",
			},
			{
				href: "/admin/orders",
				label: "Store Orders",
				icon: ShoppingCart,
				permission: "orders:view",
			},
			{
				href: "/admin/pre-bookings",
				label: "Pre-Bookings",
				icon: Clock,
				permission: "orders:view",
			},
			{
				href: "/admin/approvals",
				label: "Cash Close Approvals",
				icon: CheckCircle2,
				permission: "approvals:view",
			},
		],
	},
	{
		id: "catalog",
		title: "Catalog & Inventory",
		items: [
			{
				href: "/admin/products",
				label: "Products Catalog",
				icon: Package,
				permission: "products:view",
			},
			{
				href: "/admin/categories",
				label: "Categories",
				icon: FolderTree,
				permission: "products:view",
			},
			{
				href: "/admin/inventory",
				label: "Stock Levels",
				icon: Boxes,
				permission: "inventory:view",
			},
			{
				href: "/admin/inventory/warehouse",
				label: "Warehouse Stock",
				icon: Warehouse,
				permission: "inventory:view",
			},
			{
				href: "/admin/inventory/serialized",
				label: "Serialized Hardware",
				icon: Cpu,
				permission: "inventory:serials",
			},
			{
				href: "/admin/inventory/transfers",
				label: "Branch Transfers",
				icon: ArrowLeftRight,
				permission: "inventory:transfers",
			},
			{
				href: "/admin/inventory/procurement",
				label: "Procurement",
				icon: ShoppingBag,
				permission: "inventory:procurement",
				children: [
					{
						href: "/admin/inventory/procurement/buy",
						label: "Buy / Receive Stock",
						icon: PackagePlus,
						permission: "inventory:procurement",
					},
					{
						href: "/admin/inventory/procurement/dispatch",
						label: "Wholesale Dispatch",
						icon: PackageCheck,
						permission: "inventory:procurement",
					},
					{
						href: "/admin/inventory/procurement/exchange",
						label: "Exchange / Trade-In",
						icon: Repeat,
						permission: "inventory:procurement",
					},
					{
						href: "/admin/inventory/procurement/purchases",
						label: "Purchase List",
						icon: ClipboardList,
						permission: "inventory:procurement",
					},
					{
						href: "/admin/inventory/procurement/sales",
						label: "Sell List",
						icon: ScrollText,
						permission: "inventory:procurement",
					},
				],
			},
			{
				href: "/admin/labels",
				label: "QR / Barcode Labels",
				icon: QrCode,
				permission: "inventory:view",
			},
		],
	},
	{
		id: "logistics",
		title: "Logistics & Risk",
		items: [
			{
				href: "/admin/courier",
				label: "Courier Logistics",
				icon: Truck,
				permission: "courier:view",
			},
			{
				href: "/admin/fraud-check",
				label: "Fraud Check",
				icon: ShieldAlert,
				permission: "customers:view",
			},
		],
	},
	{
		id: "finance",
		title: "Customers & Finance",
		items: [
			{
				href: "/admin/customers",
				label: "Customers & Party",
				icon: Users,
				permission: "customers:view",
			},
			{
				href: "/admin/accounting/ledger",
				label: "Accounting Ledger",
				icon: BookOpen,
				permission: "accounting:view",
			},
			{
				href: "/admin/analytics",
				label: "Analytics & Reports",
				icon: BarChart3,
				permission: "analytics:view",
			},
		],
	},
	{
		id: "marketing",
		title: "Marketing & Growth",
		items: [
			{
				href: "/admin/sliders",
				label: "Hero Sliders",
				icon: SlidersHorizontal,
				permission: "marketing:sliders",
			},
			{
				href: "/admin/coupons",
				label: "Coupons & Discounts",
				icon: TicketPercent,
				permission: "marketing:coupons",
			},
			{
				href: "/admin/landing-pages",
				label: "Landing Pages",
				icon: Layers,
				permission: "marketing:landing",
			},
		],
	},
	{
		id: "administration",
		title: "Administration & System",
		items: [
			{
				href: "/admin/users",
				label: "Staff & Branches",
				icon: UserCog,
				permission: "staff:manage",
			},
			{
				href: "/admin/roles",
				label: "Roles & Permissions",
				icon: ShieldCheck,
				permission: "roles:manage",
			},
			{
				href: "/admin/approvals/pipelines",
				label: "Approval Pipelines",
				icon: GitBranch,
				permission: "approvals:manage",
			},
			{
				href: "/admin/settings",
				label: "Store Settings",
				icon: Settings,
				permission: "settings:manage",
			},
			{
				href: "/admin/meta-pixel",
				label: "Meta Pixel (CAPI)",
				icon: Activity,
				permission: "settings:manage",
			},
			{
				href: "/admin/google-analytics",
				label: "Google Analytics",
				icon: LineChart,
				permission: "settings:manage",
			},
		],
	},
];

// Every href in the sidebar, used to resolve which entry owns the current
// route when one entry's path is nested under another's. Permission filtering
// is deliberately not applied: a route the user reaches directly should still
// deactivate its parent entry.
export const ALL_NAV_HREFS: string[] = NAV_GROUPS.flatMap((group) =>
	group.items.flatMap((item) => [
		item.href,
		...(item.children ?? []).map((child) => child.href),
	]),
);

export function AdminLayoutClient({
	children,
	userName,
	userEmail,
	userRole,
	userInitials,
}: AdminLayoutClientProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

	const pathname = usePathname();
	const { hasPermission, isOwner, roleName } = useRBAC();

	// Load collapsed groups preference from localStorage on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem("smstech_admin_collapsed_groups");
			if (saved) {
				setCollapsedGroups(JSON.parse(saved));
			}
			const savedCollapsed = localStorage.getItem("smstech_admin_sidebar_collapsed");
			if (savedCollapsed) {
				setSidebarCollapsed(JSON.parse(savedCollapsed));
			}
		} catch (e) {
			console.error("Failed to load sidebar preferences", e);
		}
	}, []);

	// Toggle group collapsed state
	const toggleGroup = (groupId: string) => {
		setCollapsedGroups((prev) => {
			const next = { ...prev, [groupId]: !prev[groupId] };
			try {
				localStorage.setItem("smstech_admin_collapsed_groups", JSON.stringify(next));
			} catch (e) {
				console.error(e);
			}
			return next;
		});
	};

	// Toggle desktop sidebar collapse
	const toggleSidebarCollapse = () => {
		setSidebarCollapsed((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("smstech_admin_sidebar_collapsed", JSON.stringify(next));
			} catch (e) {
				console.error(e);
			}
			return next;
		});
	};

	// Filter navigation items by permission and search query
	const visibleGroups = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();

		const permitted = (item: NavItemDef) =>
			item.permission ? hasPermission(item.permission) : true;

		return NAV_GROUPS.map((group) => {
			// Filter items — and their sub-pages — based on RBAC permissions
			const permittedItems: NavItemDef[] = group.items
				.filter(permitted)
				.map((item) =>
					item.children ? { ...item, children: item.children.filter(permitted) } : item,
				);

			// Further filter by search query if any. A parent survives when one
			// of its sub-pages matches, so searching "dispatch" finds the page
			// rather than nothing.
			const searchedItems = query
				? permittedItems.flatMap((item) => {
						if (item.label.toLowerCase().includes(query)) return [item];
						const childHits =
							item.children?.filter((child) =>
								child.label.toLowerCase().includes(query),
							) ?? [];
						return childHits.length > 0 ? [{ ...item, children: childHits }] : [];
				  })
				: permittedItems;

			return {
				...group,
				items: searchedItems,
			};
		}).filter((group) => group.items.length > 0); // Hide groups that have 0 permitted items
	}, [hasPermission, searchQuery]);

	// Auto-expand group if it contains current active route.
	const isItemActive = (href: string) =>
		isNavItemActive(pathname, href, ALL_NAV_HREFS);

	// Close mobile menu when pressing Escape
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setMobileMenuOpen(false);
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, []);

	// Prevent body scroll when mobile menu is open
	useEffect(() => {
		if (mobileMenuOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileMenuOpen]);

	// Close mobile menu on route change
	useEffect(() => {
		setMobileMenuOpen(false);
	}, [pathname]);

	return (
		<div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex">
			{/* Desktop Sidebar */}
			<aside
				className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 hidden lg:flex flex-col transition-all duration-300 ease-in-out ${
					sidebarCollapsed ? "w-20" : "w-64"
				}`}>
				{/* Sidebar Header */}
				<div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
					{!sidebarCollapsed ? (
						<Link
							href="/admin/dashboard"
							className="flex items-center gap-2.5 overflow-hidden group">
							<div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
								⚡
							</div>
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white truncate">
									Admin Panel
								</span>
								<span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
									<Shield className="w-3 h-3 inline" />
									{roleName || userRole || (isOwner ? "Owner" : "Admin")}
								</span>
							</div>
						</Link>
					) : (
						<Link
							href="/admin/dashboard"
							className="mx-auto w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-base shadow-sm hover:scale-105 transition-transform"
							title="Admin Dashboard">
							⚡
						</Link>
					)}

					<button
						onClick={toggleSidebarCollapse}
						className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
							sidebarCollapsed ? "hidden" : "block"
						}`}
						title="Collapse sidebar">
						<PanelLeftClose className="w-4 h-4" />
					</button>
				</div>

				{/* Search bar (only when expanded) */}
				{!sidebarCollapsed && (
					<div className="px-3 pt-3 pb-1 shrink-0">
						<div className="relative">
							<Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Quick filter..."
								className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery("")}
									className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
									<X className="w-3 h-3" />
								</button>
							)}
						</div>
					</div>
				)}

				{/* Navigation Groups List */}
				<nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 select-none scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
					{visibleGroups.length === 0 ? (
						<div className="text-center py-6 px-2 text-xs text-zinc-400">
							No menu items match your search.
						</div>
					) : (
						visibleGroups.map((group) => {
							const hasActiveChild = group.items.some((item) => isItemActive(item.href));
							// If active item inside or searching, keep open even if user collapsed it previously
							const isCollapsed = Boolean(
								collapsedGroups[group.id] && !hasActiveChild && !searchQuery
							);

							return (
								<div key={group.id} className="space-y-1">
									{/* Group Header */}
									{!sidebarCollapsed ? (
										<button
											type="button"
											onClick={() => toggleGroup(group.id)}
											className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors group">
											<span>{group.title}</span>
											<span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
												{isCollapsed ? (
													<ChevronRight className="w-3.5 h-3.5" />
												) : (
													<ChevronDown className="w-3.5 h-3.5" />
												)}
											</span>
										</button>
									) : (
										<div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2 mx-1" />
									)}

									{/* Group Items */}
									{(!isCollapsed || sidebarCollapsed) && (
										<div className="space-y-0.5">
											{group.items.map((item) => (
												<SidebarNavItem
													key={item.href}
													item={item}
													isActive={isItemActive(item.href)}
													isCollapsed={sidebarCollapsed}
													isChildActive={isItemActive}
													forceExpanded={!!searchQuery}
												/>
											))}
										</div>
									)}
								</div>
							);
						})
					)}
				</nav>

				{/* Sidebar Footer */}
				<div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
					{!sidebarCollapsed ? (
						<>
							<Link
								href="/"
								className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
								<ArrowLeft className="w-3.5 h-3.5" />
								<span>Storefront</span>
							</Link>
							<button
								onClick={toggleSidebarCollapse}
								className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
								title="Collapse sidebar">
								<PanelLeftClose className="w-4 h-4" />
							</button>
						</>
					) : (
						<button
							onClick={toggleSidebarCollapse}
							className="w-full flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
							title="Expand sidebar">
							<PanelLeftOpen className="w-4 h-4" />
						</button>
					)}
				</div>
			</aside>

			{/* Mobile Menu Backdrop */}
			{mobileMenuOpen && (
				<div
					className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
					onClick={() => setMobileMenuOpen(false)}
					aria-hidden="true"
				/>
			)}

			{/* Mobile Drawer Sidebar */}
			<aside
				className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
					mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
				}`}>
				{/* Mobile Header */}
				<div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
					<Link
						href="/admin/dashboard"
						className="flex items-center gap-2.5"
						onClick={() => setMobileMenuOpen(false)}>
						<div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
							⚡
						</div>
						<div className="flex flex-col">
							<span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white">
								Admin Panel
							</span>
							<span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
								<Shield className="w-3 h-3 inline" />
								{roleName || userRole || (isOwner ? "Owner" : "Admin")}
							</span>
						</div>
					</Link>
					<button
						onClick={() => setMobileMenuOpen(false)}
						className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
						aria-label="Close menu">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Mobile Search */}
				<div className="px-3 pt-3 pb-1 shrink-0">
					<div className="relative">
						<Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Quick filter navigation..."
							className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
								<X className="w-3 h-3" />
							</button>
						)}
					</div>
				</div>

				{/* Mobile Navigation List */}
				<nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
					{visibleGroups.map((group) => {
						const hasActiveChild = group.items.some((item) => isItemActive(item.href));
						const isCollapsed = Boolean(
							collapsedGroups[group.id] && !hasActiveChild && !searchQuery
						);

						return (
							<div key={group.id} className="space-y-1">
								<button
									type="button"
									onClick={() => toggleGroup(group.id)}
									className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
									<span>{group.title}</span>
									<span>
										{isCollapsed ? (
											<ChevronRight className="w-3.5 h-3.5" />
										) : (
											<ChevronDown className="w-3.5 h-3.5" />
										)}
									</span>
								</button>

								{!isCollapsed && (
									<div className="space-y-0.5">
										{group.items.map((item) => (
											<SidebarNavItem
												key={item.href}
												item={item}
												isActive={isItemActive(item.href)}
												onClick={() => setMobileMenuOpen(false)}
												isChildActive={isItemActive}
												forceExpanded={!!searchQuery}
											/>
										))}
									</div>
								)}
							</div>
						);
					})}
				</nav>

				{/* Mobile Footer */}
				<div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
					<Link
						href="/"
						onClick={() => setMobileMenuOpen(false)}
						className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
						<ArrowLeft className="w-3.5 h-3.5" />
						<span>Back to Storefront</span>
					</Link>
				</div>
			</aside>

			{/* Main Wrapper */}
			<div
				className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
					sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
				}`}>
				{/* Top Bar */}
				<header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6">
					<div className="flex items-center gap-3">
						<button
							className="lg:hidden p-2 -ml-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
							onClick={() => setMobileMenuOpen(true)}
							aria-label="Open navigation menu">
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
						</button>
						<span className="text-sm font-semibold text-zinc-900 dark:text-white lg:hidden">
							Admin Panel
						</span>
					</div>

					<div className="flex items-center gap-2 sm:gap-4">
						<BranchSwitcher />
						<ThemeSwitcher />
						<UserMenu
							userName={userName}
							userEmail={userEmail}
							userRole={userRole}
							userInitials={userInitials}
						/>
					</div>
				</header>

				{/* Page Content */}
				<main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
					{children}
				</main>
			</div>
		</div>
	);
}

function SidebarNavItem({
	item,
	isActive,
	isCollapsed,
	onClick,
	isChildActive,
	forceExpanded,
}: {
	item: NavItemDef;
	isActive: boolean;
	isCollapsed?: boolean;
	onClick?: () => void;
	/** Whether a given sub-page is the current route. */
	isChildActive?: (href: string) => boolean;
	/** Open the sub-list even when the route is elsewhere — used while searching. */
	forceExpanded?: boolean;
}) {
	const Icon = item.icon;
	const children = item.children ?? [];

	// Sub-pages appear once you are inside the section, so the sidebar stays
	// short everywhere else. A collapsed rail has no room for them at all.
	const expanded =
		!isCollapsed &&
		children.length > 0 &&
		(forceExpanded || isActive || children.some((child) => isChildActive?.(child.href)));

	const badgeColorStyles = {
		emerald:
			"bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
		blue:
			"bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
		amber:
			"bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
		purple:
			"bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800",
	};

	const link = (
		<Link
			href={item.href}
			onClick={onClick}
			title={isCollapsed ? item.label : undefined}
			className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
				isActive
					? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
					: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100"
			} ${isCollapsed ? "justify-center px-0" : ""}`}>
			{/* Active vertical indicator bar */}
			{isActive && (
				<span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-500 rounded-r-full" />
			)}

			<Icon
				className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
					isActive
						? "text-blue-600 dark:text-blue-400"
						: "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
				}`}
			/>

			{!isCollapsed && (
				<div className="flex-1 flex items-center justify-between min-w-0">
					<span className="truncate">{item.label}</span>
					{item.badge && (
						<span
							className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 ml-1.5 ${
								item.badgeVariant
									? badgeColorStyles[item.badgeVariant]
									: badgeColorStyles.blue
							}`}>
							{item.badge}
						</span>
					)}
				</div>
			)}
		</Link>
	);

	if (children.length === 0) return link;

	return (
		<div>
			{link}
			{expanded && (
				<div className="mt-0.5 ml-4 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
					{children.map((child) => {
						const ChildIcon = child.icon;
						const childActive = isChildActive?.(child.href) ?? false;

						return (
							<Link
								key={child.href}
								href={child.href}
								onClick={onClick}
								className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
									childActive
										? "bg-blue-50 font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
										: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
								}`}>
								<ChildIcon
									className={`h-3.5 w-3.5 shrink-0 ${
										childActive
											? "text-blue-600 dark:text-blue-400"
											: "text-zinc-400 dark:text-zinc-600"
									}`}
								/>
								<span className="truncate">{child.label}</span>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

