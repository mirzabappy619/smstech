// ============================================================================
// Granular System Permissions & Default Role Matrices
// ============================================================================

export interface SystemPermission {
	code: string;
	name: string;
	description: string;
	module: PermissionModule;
}

export type PermissionModule =
	| "Dashboard"
	| "Analytics"
	| "POS"
	| "Products"
	| "Inventory"
	| "Orders"
	| "Courier"
	| "Customers"
	| "Accounting"
	| "Marketing"
	| "Administration";

export const PERMISSIONS: Record<string, SystemPermission> = {
	// Dashboard & Analytics
	"dashboard:view": {
		code: "dashboard:view",
		name: "View Dashboard Overview",
		description: "Access high-level sales and operational KPIs",
		module: "Dashboard",
	},
	"analytics:view": {
		code: "analytics:view",
		name: "View Analytics Reports",
		description: "Access sales analytics, profit margins, and customer insights",
		module: "Analytics",
	},

	// POS Terminal
	"pos:access": {
		code: "pos:access",
		name: "Access POS Terminal",
		description: "Open and operate the shop POS cash register",
		module: "POS",
	},
	"pos:shifts": {
		code: "pos:shifts",
		name: "Manage Cash Shifts",
		description: "Open, reconcile, and close daily cash drawer shifts",
		module: "POS",
	},
	"pos:discounts": {
		code: "pos:discounts",
		name: "Apply Custom Discounts",
		description: "Apply custom discounts and promo markdowns at POS checkout",
		module: "POS",
	},
	"pos:refund": {
		code: "pos:refund",
		name: "Process POS Refunds",
		description: "Issue cash or store credit refunds at POS checkout",
		module: "POS",
	},

	// Products Catalog
	"products:view": {
		code: "products:view",
		name: "View Products Catalog",
		description: "Browse catalog items, pricing, and specifications",
		module: "Products",
	},
	"products:create": {
		code: "products:create",
		name: "Create Products",
		description: "Add new products and variations to the catalog",
		module: "Products",
	},
	"products:edit": {
		code: "products:edit",
		name: "Edit Products",
		description: "Update product information, pricing, images, and descriptions",
		module: "Products",
	},
	"products:delete": {
		code: "products:delete",
		name: "Delete Products",
		description: "Remove or archive items from the product catalog",
		module: "Products",
	},

	// Inventory & Serialized Hardware
	"inventory:view": {
		code: "inventory:view",
		name: "View Inventory Stock",
		description: "View stock levels across warehouses and branches",
		module: "Inventory",
	},
	"inventory:adjust": {
		code: "inventory:adjust",
		name: "Adjust Stock Levels",
		description: "Perform manual stock additions, subtractions, and damage write-offs",
		module: "Inventory",
	},
	"inventory:serials": {
		code: "inventory:serials",
		name: "Manage Serial Numbers & IMEIs",
		description: "Add, scan, and audit serialized hardware units and battery health",
		module: "Inventory",
	},
	"inventory:transfers": {
		code: "inventory:transfers",
		name: "Manage Branch Transfers",
		description: "Initiate, dispatch, and receive inter-branch inventory transfers",
		module: "Inventory",
	},
	"inventory:procurement": {
		code: "inventory:procurement",
		name: "Batch Procurement & Buyback",
		description: "Record purchase batches and customer trade-in buybacks",
		module: "Inventory",
	},

	// Orders & Billing
	"orders:view": {
		code: "orders:view",
		name: "View Store Orders",
		description: "View all eCommerce and POS customer orders",
		module: "Orders",
	},
	"orders:create": {
		code: "orders:create",
		name: "Create Orders",
		description: "Create manual orders on behalf of customers",
		module: "Orders",
	},
	"orders:edit_status": {
		code: "orders:edit_status",
		name: "Update Order Status",
		description: "Change order processing, packaging, and fulfillment statuses",
		module: "Orders",
	},
	"orders:cancel": {
		code: "orders:cancel",
		name: "Cancel Orders",
		description: "Cancel orders and release reserved inventory",
		module: "Orders",
	},
	"orders:invoice": {
		code: "orders:invoice",
		name: "Print Invoices & Slips",
		description: "Print thermal receipts, invoices, and packing slips",
		module: "Orders",
	},

	// Logistics & Courier
	"courier:view": {
		code: "courier:view",
		name: "View Courier Logistics",
		description: "Monitor shipping tracking and delivery dispatch statuses",
		module: "Courier",
	},
	"courier:manage": {
		code: "courier:manage",
		name: "Send to Courier",
		description: "Dispatch packages via Pathao, Steadfast, and internal drivers",
		module: "Courier",
	},
	"courier:settings": {
		code: "courier:settings",
		name: "Configure Courier APIs",
		description: "Manage API keys and courier warehouse settings",
		module: "Courier",
	},

	// Party Accounting & Customers
	"customers:view": {
		code: "customers:view",
		name: "View Customers",
		description: "Access customer profiles, purchase history, and contact details",
		module: "Customers",
	},
	"customers:edit": {
		code: "customers:edit",
		name: "Edit Customer Profiles",
		description: "Update customer credit limits, loyalty tiers, and notes",
		module: "Customers",
	},
	"accounting:view": {
		code: "accounting:view",
		name: "View Accounting Ledgers",
		description: "Inspect party ledgers, accounts receivable, and payables",
		module: "Accounting",
	},
	"accounting:manage": {
		code: "accounting:manage",
		name: "Manage Ledgers & Due Payments",
		description: "Record payments, collections, advances, and manual adjustments",
		module: "Accounting",
	},

	// Marketing & Landing Pages
	"marketing:coupons": {
		code: "marketing:coupons",
		name: "Manage Coupons",
		description: "Create and manage discount codes and promotional vouchers",
		module: "Marketing",
	},
	"marketing:landing": {
		code: "marketing:landing",
		name: "Manage Landing Pages",
		description: "Build and publish drag-and-drop promotional landing pages",
		module: "Marketing",
	},
	"marketing:sliders": {
		code: "marketing:sliders",
		name: "Manage Hero Sliders",
		description: "Configure homepage banner carousels and promotional graphics",
		module: "Marketing",
	},

	// Administration & Security
	"branches:manage": {
		code: "branches:manage",
		name: "Manage Branch Locations",
		description: "Add, rename, and configure branch warehouses and store pickup",
		module: "Administration",
	},
	"roles:manage": {
		code: "roles:manage",
		name: "Manage Roles & Permissions",
		description: "Create custom roles and customize permission matrices",
		module: "Administration",
	},
	"staff:manage": {
		code: "staff:manage",
		name: "Manage Staff & Branch Assignments",
		description: "Create staff accounts and assign branch access permissions",
		module: "Administration",
	},
	"settings:manage": {
		code: "settings:manage",
		name: "Manage Store Settings",
		description: "Configure general store settings, tax rates, and integrations",
		module: "Administration",
	},
};

export const ALL_PERMISSION_CODES = Object.keys(PERMISSIONS);

export const MODULE_ORDER: PermissionModule[] = [
	"Dashboard",
	"POS",
	"Products",
	"Inventory",
	"Orders",
	"Courier",
	"Customers",
	"Accounting",
	"Marketing",
	"Analytics",
	"Administration",
];

// System Default Role Permissions Fallback Matrix
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
	owner: ALL_PERMISSION_CODES, // Full unrestricted access
	admin: ALL_PERMISSION_CODES.filter((code) => code !== "roles:manage"),
	branch_manager: [
		"dashboard:view",
		"pos:access",
		"pos:shifts",
		"pos:discounts",
		"pos:refund",
		"products:view",
		"inventory:view",
		"inventory:adjust",
		"inventory:serials",
		"inventory:transfers",
		"orders:view",
		"orders:create",
		"orders:edit_status",
		"orders:invoice",
		"customers:view",
		"customers:edit",
		"accounting:view",
		"accounting:manage",
	],
	cashier: [
		"pos:access",
		"pos:shifts",
		"products:view",
		"inventory:view",
		"orders:view",
		"orders:create",
		"orders:invoice",
		"customers:view",
	],
	inventory_manager: [
		"products:view",
		"products:create",
		"products:edit",
		"inventory:view",
		"inventory:adjust",
		"inventory:serials",
		"inventory:transfers",
		"inventory:procurement",
		"orders:view",
		"orders:invoice",
	],
	accountant: [
		"dashboard:view",
		"analytics:view",
		"orders:view",
		"customers:view",
		"accounting:view",
		"accounting:manage",
	],
	delivery_agent: ["orders:view", "orders:edit_status", "courier:view"],
	customer: [],
	staff: ["dashboard:view", "pos:access", "products:view", "orders:view"],
};
