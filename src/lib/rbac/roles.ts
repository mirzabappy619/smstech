// ============================================================================
// System Roles Catalog & Hierarchy
// ============================================================================

export interface SystemRoleDefinition {
	key: string;
	name: string;
	description: string;
	isSystem: boolean;
	badgeColor: string;
	level: number; // Higher number = more authoritative
}

export const SYSTEM_ROLES: Record<string, SystemRoleDefinition> = {
	owner: {
		key: "owner",
		name: "Superadmin / Owner",
		description: "Full unrestricted access to all system modules, financial ledgers, and branches.",
		isSystem: true,
		badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300",
		level: 100,
	},
	admin: {
		key: "admin",
		name: "General Administrator",
		description: "Operational administration across all modules, products, and fulfillment.",
		isSystem: true,
		badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300",
		level: 80,
	},
	branch_manager: {
		key: "branch_manager",
		name: "Branch Manager",
		description: "Full management over assigned branch operations, POS shifts, staff, and stock.",
		isSystem: true,
		badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300",
		level: 60,
	},
	cashier: {
		key: "cashier",
		name: "Branch Cashier",
		description: "Point of sale cashier, invoice billing, and payment collection at assigned branch.",
		isSystem: true,
		badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300",
		level: 40,
	},
	inventory_manager: {
		key: "inventory_manager",
		name: "Inventory Manager",
		description: "Stock audits, serialized hardware devices, and inter-branch transfers.",
		isSystem: true,
		badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-300",
		level: 50,
	},
	accountant: {
		key: "accountant",
		name: "Accountant",
		description: "Financial party ledgers, dues clearance, and sales revenue analytics.",
		isSystem: true,
		badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300",
		level: 50,
	},
	delivery_agent: {
		key: "delivery_agent",
		name: "Delivery Agent",
		description: "Access to assigned shipments, order status updates, and courier dispatch.",
		isSystem: true,
		badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border-teal-300",
		level: 30,
	},
	staff: {
		key: "staff",
		name: "General Staff",
		description: "General staff member with basic access.",
		isSystem: true,
		badgeColor: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300",
		level: 20,
	},
	customer: {
		key: "customer",
		name: "Customer",
		description: "Default storefront customer account.",
		isSystem: true,
		badgeColor: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300",
		level: 10,
	},
};
