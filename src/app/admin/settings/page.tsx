"use client";

import { useState, useEffect, useCallback } from "react";

interface ShippingMethod {
	id: string;
	name: string;
	description: string;
	price: number;
	is_active: boolean;
}

interface HomepageStat {
	value: string;
	label: string;
}

interface HomepageCTA {
	text: string;
	link: string;
}

interface HomepageSettings {
	hero_badge: string;
	hero_title: string;
	hero_subtitle: string;
	hero_image: string;
	stats: HomepageStat[];
	category_limit: number;
	cta_primary: HomepageCTA;
	cta_secondary: HomepageCTA;
}

interface StoreSettings {
	store_name: string;
	store_email: string;
	store_phone: string;
	store_address: string;
	store_currency: string;
	store_timezone: string;
	tax_rate: number;
	shipping_enabled: boolean;
	free_shipping_threshold: number;
	default_shipping_cost: number;
	inventory_tracking: boolean;
	low_stock_threshold: number;
	allow_guest_checkout: boolean;
	order_prefix: string;
	notify_on_order: boolean;
	notify_on_low_stock: boolean;
	social_facebook: string;
	social_instagram: string;
	social_twitter: string;
	social_youtube: string;
	social_whatsapp: string;
	maintenance_mode: boolean;
	shipping_methods: ShippingMethod[];
	homepage_settings: HomepageSettings;
}

const defaultSettings: StoreSettings = {
	store_name: "SMSTech BD",
	store_email: "info@smstech.bd",
	store_phone: "01781485588, 01723249598",
	store_address: "Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205",
	store_currency: "BDT",
	store_timezone: "Asia/Dhaka",
	tax_rate: 0,
	shipping_enabled: true,
	free_shipping_threshold: 0,
	default_shipping_cost: 60,
	inventory_tracking: true,
	low_stock_threshold: 10,
	allow_guest_checkout: true,
	order_prefix: "SMST",
	notify_on_order: true,
	notify_on_low_stock: true,
	social_facebook: "https://facebook.com/smstech.bd",
	social_instagram: "https://instagram.com/smstech.bd",
	social_twitter: "https://twitter.com/smstechbd",
	social_youtube: "https://youtube.com/@smstech",
	social_whatsapp: "https://wa.me/8801781485588",
	maintenance_mode: false,
	shipping_methods: [
		{ id: "standard", name: "Inside Dhaka Delivery", description: "24–48 hours", price: 60, is_active: true },
		{ id: "express",  name: "Outside Dhaka Courier",  description: "2-4 business days", price: 120, is_active: true },
		{ id: "free",     name: "Store Pickup",     description: "Multiplan Center Level-3 Shop 309", price: 0,  is_active: true },
	],
	homepage_settings: {
		hero_badge: "New Arrivals Daily",
		hero_title: "Tech That Transforms Your Life",
		hero_subtitle: "Discover cutting-edge electronics at unbeatable prices. Free shipping, 2-year warranty, and 30-day returns on all orders.",
		hero_image: "",
		stats: [
			{ value: "5K+",  label: "Products" },
			{ value: "100+", label: "Brands" },
			{ value: "50K+", label: "Happy Customers" },
		],
		category_limit: 8,
		cta_primary:   { text: "Shop Now",   link: "/products" },
		cta_secondary: { text: "View Deals", link: "/deals" },
	},
};

// Taka first — it is the store default and the currency every price is
// entered in. The rest remain selectable for a future multi-currency store.
const currencies = [
	{ code: "BDT", name: "Bangladeshi Taka (৳)" },
	{ code: "USD", name: "US Dollar ($)" },
	{ code: "EUR", name: "Euro (€)" },
	{ code: "GBP", name: "British Pound (£)" },
	{ code: "INR", name: "Indian Rupee (₹)" },
	{ code: "CAD", name: "Canadian Dollar (CA$)" },
	{ code: "AUD", name: "Australian Dollar (A$)" },
	{ code: "JPY", name: "Japanese Yen (¥)" },
];

const timezones = [
	// Asia/Dhaka is the store default; without it here the select fell back to
	// the first entry and silently rewrote the timezone on the next save.
	"Asia/Dhaka",
	"Asia/Kolkata",
	"Asia/Karachi",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Toronto",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Asia/Dubai",
	"Australia/Sydney",
];

export default function SettingsPage() {
	const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("general");

	const [newMethod, setNewMethod] = useState<Omit<ShippingMethod, "id">>({
		name: "",
		description: "",
		price: 0,
		is_active: true,
	});

	const addShippingMethod = () => {
		if (!newMethod.name.trim()) return;
		const id = newMethod.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") + "_" + Date.now();
		setSettings((prev) => ({
			...prev,
			shipping_methods: [
				...(prev.shipping_methods || []),
				{ ...newMethod, id },
			],
		}));
		setNewMethod({ name: "", description: "", price: 0, is_active: true });
	};

	const updateShippingMethod = (index: number, field: keyof ShippingMethod, value: string | number | boolean) => {
		setSettings((prev) => {
			const methods = [...(prev.shipping_methods || [])];
			methods[index] = { ...methods[index], [field]: value };
			return { ...prev, shipping_methods: methods };
		});
	};

	const removeShippingMethod = (index: number) => {
		setSettings((prev) => ({
			...prev,
			shipping_methods: (prev.shipping_methods || []).filter((_, i) => i !== index),
		}));
	};

	const fetchSettings = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/v1/admin/settings");
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error?.message || "Failed to fetch settings");
			}
			const data = await response.json();
			const raw = data.data.settings;
			// Convert null values from DB to empty strings so controlled inputs work
			setSettings({
				...defaultSettings,
				...Object.fromEntries(
					Object.entries(raw).map(([k, v]) => [k, v ?? defaultSettings[k as keyof typeof defaultSettings] ?? ""]),
				),
			} as typeof defaultSettings);
		} catch (err) {
			console.error("Error fetching settings:", err);
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const response = await fetch("/api/v1/admin/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error?.message || "Failed to save settings");
			}
			setSuccess("Settings saved successfully!");
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Error saving settings:", err);
			setError(err instanceof Error ? err.message : "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	const handleChange = (
		field: keyof StoreSettings,
		value: string | number | boolean,
	) => {
		setSettings((prev) => ({ ...prev, [field]: value }));
	};

	const [heroUploading, setHeroUploading] = useState(false);
	const [heroUploadError, setHeroUploadError] = useState("");

	const handleHomepageChange = (field: keyof HomepageSettings, value: HomepageSettings[keyof HomepageSettings]) => {
		setSettings((prev) => ({
			...prev,
			homepage_settings: { ...prev.homepage_settings, [field]: value },
		}));
	};

	const updateStat = (index: number, field: keyof HomepageStat, value: string) => {
		setSettings((prev) => {
			const stats = [...prev.homepage_settings.stats];
			stats[index] = { ...stats[index], [field]: value };
			return { ...prev, homepage_settings: { ...prev.homepage_settings, stats } };
		});
	};

	const updateCTA = (which: "cta_primary" | "cta_secondary", field: "text" | "link", value: string) => {
		setSettings((prev) => ({
			...prev,
			homepage_settings: {
				...prev.homepage_settings,
				[which]: { ...prev.homepage_settings[which], [field]: value },
			},
		}));
	};

	const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setHeroUploading(true);
		setHeroUploadError("");
		try {
			const fd = new FormData();
			fd.append("file", file);
			fd.append("bucket", "products");
			fd.append("folder", "hero");
			const res = await fetch("/api/v1/storage/upload", { method: "POST", body: fd });
			const data = await res.json();
			const url = data?.data?.publicUrl || data?.publicUrl;
			if (!url) throw new Error("No URL returned");
			handleHomepageChange("hero_image", url);
		} catch (err) {
			setHeroUploadError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setHeroUploading(false);
			e.target.value = "";
		}
	};

	const tabs = [
		{
			id: "general",
			label: "General",
			icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
		},
		{
			id: "homepage",
			label: "Homepage",
			icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
		},
		{
			id: "shipping",
			label: "Shipping",
			icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
		},
		{
			id: "inventory",
			label: "Inventory",
			icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
		},
		{
			id: "checkout",
			label: "Checkout",
			icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
		},
		{
			id: "notifications",
			label: "Notifications",
			icon: "M15 17h5l-5 5v-5zM15 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v8m-7 4v-4m0 0l-2-2m2 2l2-2",
		},
		{
			id: "social",
			label: "Social Media",
			icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
		},
	];

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48 animate-pulse" />
				<div className="flex gap-6">
					<div className="w-48 space-y-2">
						{[...Array(6)].map((_, i) => (
							<div
								key={i}
								className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
							/>
						))}
					</div>
					<div className="flex-1 h-96 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Settings
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">
						Manage your store configuration
					</p>
				</div>
				<button
					onClick={handleSave}
					disabled={saving}
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
					{saving ? (
						<>
							<svg
								className="w-4 h-4 animate-spin"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							Saving...
						</>
					) : (
						<>
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
							Save Changes
						</>
					)}
				</button>
			</div>

			{error && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-red-400 mr-2"
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
						<span className="text-red-700 dark:text-red-300">{error}</span>
					</div>
				</div>
			)}

			{success && (
				<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-green-400 mr-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span className="text-green-700 dark:text-green-300">
							{success}
						</span>
					</div>
				</div>
			)}

			{/* Maintenance Mode Warning */}
			{settings.maintenance_mode && (
				<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-yellow-400 mr-2"
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
						<span className="text-yellow-800 dark:text-yellow-200 font-medium">
							Maintenance mode is ON. Your store is not accessible to customers.
						</span>
					</div>
				</div>
			)}

			<div className="flex gap-6">
				{/* Sidebar Tabs */}
				<div className="w-48 space-y-1">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
								activeTab === tab.id
									? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
									: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
							}`}>
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d={tab.icon}
								/>
							</svg>
							{tab.label}
						</button>
					))}
				</div>

				{/* Content Area */}
				<div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					{activeTab === "general" && (
						<div className="space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								General Settings
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Store Name
									</label>
									<input
										type="text"
										value={settings.store_name}
										onChange={(e) => handleChange("store_name", e.target.value)}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Store Email
									</label>
									<input
										type="email"
										value={settings.store_email}
										onChange={(e) =>
											handleChange("store_email", e.target.value)
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Store Phone
									</label>
									<input
										type="tel"
										value={settings.store_phone}
										onChange={(e) =>
											handleChange("store_phone", e.target.value)
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Currency
									</label>
									<select
										value={settings.store_currency}
										onChange={(e) =>
											handleChange("store_currency", e.target.value)
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										{currencies.map((c) => (
											<option
												key={c.code}
												value={c.code}>
												{c.code} - {c.name}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Timezone
									</label>
									<select
										value={settings.store_timezone}
										onChange={(e) =>
											handleChange("store_timezone", e.target.value)
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										{timezones.map((tz) => (
											<option
												key={tz}
												value={tz}>
												{tz}
											</option>
										))}
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Tax Rate (%)
									</label>
									<input
										type="number"
										min="0"
										max="100"
										step="0.01"
										value={settings.tax_rate}
										onChange={(e) =>
											handleChange("tax_rate", parseFloat(e.target.value) || 0)
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Store Address
								</label>
								<textarea
									rows={3}
									value={settings.store_address}
									onChange={(e) =>
										handleChange("store_address", e.target.value)
									}
									className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
							</div>

							<div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										Maintenance Mode
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Enable to temporarily disable your store for customers
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.maintenance_mode}
										onChange={(e) =>
											handleChange("maintenance_mode", e.target.checked)
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-red-600"></div>
								</label>
							</div>
						</div>
					)}

					{activeTab === "homepage" && (
						<div className="space-y-8">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Homepage Settings
							</h2>

							{/* Hero Section */}
							<div className="space-y-4">
								<h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Hero Section</h3>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Badge Text
									</label>
									<input
										type="text"
										value={settings.homepage_settings?.hero_badge ?? ""}
										onChange={(e) => handleHomepageChange("hero_badge", e.target.value)}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="e.g. New Arrivals Daily"
									/>
									<p className="text-xs text-zinc-500 mt-1">Small label shown above the headline</p>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Hero Headline
									</label>
									<input
										type="text"
										value={settings.homepage_settings?.hero_title ?? ""}
										onChange={(e) => handleHomepageChange("hero_title", e.target.value)}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="e.g. Tech That Transforms Your Life"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Hero Subtitle
									</label>
									<textarea
										rows={3}
										value={settings.homepage_settings?.hero_subtitle ?? ""}
										onChange={(e) => handleHomepageChange("hero_subtitle", e.target.value)}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none"
										placeholder="Supporting text below the headline"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Hero Image
									</label>
									{/* Preview */}
									{settings.homepage_settings?.hero_image && (
										<div className="mb-3 relative">
											<img
												src={settings.homepage_settings.hero_image}
												alt="Hero preview"
												className="h-40 w-full object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
											/>
											<button
												type="button"
												onClick={() => handleHomepageChange("hero_image", "")}
												className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
												Remove
											</button>
										</div>
									)}
									{/* Upload */}
									<div className="flex items-center gap-3 flex-wrap">
										<label className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg border-2 border-dashed transition-colors ${heroUploading ? "opacity-50 cursor-not-allowed border-zinc-300 text-zinc-400" : "border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}>
											{heroUploading ? "Uploading…" : "Upload Image"}
											<input
												type="file"
												accept="image/*"
												className="hidden"
												disabled={heroUploading}
												onChange={handleHeroImageUpload}
											/>
										</label>
										<span className="text-zinc-400 text-sm">or</span>
										<input
											type="url"
											value={settings.homepage_settings?.hero_image ?? ""}
											onChange={(e) => handleHomepageChange("hero_image", e.target.value)}
											className="flex-1 min-w-[200px] px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
											placeholder="Paste image URL…"
										/>
									</div>
									{heroUploadError && <p className="mt-1 text-xs text-red-600">{heroUploadError}</p>}
									<p className="text-xs text-zinc-500 mt-1">Leave blank to show the default icon placeholder</p>
								</div>
							</div>

							{/* Statistics */}
							<div className="space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-6">
								<h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Statistics</h3>
								<p className="text-xs text-zinc-500 dark:text-zinc-400">The 3 numbers shown below the hero buttons</p>
								<div className="space-y-3">
									{(settings.homepage_settings?.stats ?? []).map((stat, i) => (
										<div key={i} className="flex gap-3 items-center">
											<span className="text-xs text-zinc-400 w-4">{i + 1}.</span>
											<input
												type="text"
												value={stat.value}
												onChange={(e) => updateStat(i, "value", e.target.value)}
												className="w-28 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-bold"
												placeholder="5K+"
											/>
											<input
												type="text"
												value={stat.label}
												onChange={(e) => updateStat(i, "label", e.target.value)}
												className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												placeholder="Products"
											/>
										</div>
									))}
								</div>
							</div>

							{/* CTA Buttons */}
							<div className="space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-6">
								<h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Call-to-Action Buttons</h3>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="space-y-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
										<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Primary Button</p>
										<div>
											<label className="block text-xs text-zinc-500 mb-1">Label</label>
											<input
												type="text"
												value={settings.homepage_settings?.cta_primary?.text ?? "Shop Now"}
												onChange={(e) => updateCTA("cta_primary", "text", e.target.value)}
												className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												placeholder="Shop Now"
											/>
										</div>
										<div>
											<label className="block text-xs text-zinc-500 mb-1">Link</label>
											<input
												type="text"
												value={settings.homepage_settings?.cta_primary?.link ?? "/products"}
												onChange={(e) => updateCTA("cta_primary", "link", e.target.value)}
												className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												placeholder="/products"
											/>
										</div>
									</div>

									<div className="space-y-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
										<p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Secondary Button</p>
										<div>
											<label className="block text-xs text-zinc-500 mb-1">Label</label>
											<input
												type="text"
												value={settings.homepage_settings?.cta_secondary?.text ?? "View Deals"}
												onChange={(e) => updateCTA("cta_secondary", "text", e.target.value)}
												className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												placeholder="View Deals"
											/>
										</div>
										<div>
											<label className="block text-xs text-zinc-500 mb-1">Link</label>
											<input
												type="text"
												value={settings.homepage_settings?.cta_secondary?.link ?? "/deals"}
												onChange={(e) => updateCTA("cta_secondary", "link", e.target.value)}
												className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												placeholder="/deals"
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Categories */}
							<div className="space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-6">
								<h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Categories Display</h3>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Number of categories to show
									</label>
									<input
										type="number"
										min={1}
										max={20}
										value={settings.homepage_settings?.category_limit ?? 8}
										onChange={(e) => handleHomepageChange("category_limit", parseInt(e.target.value) || 8)}
										className="w-32 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
									<p className="text-xs text-zinc-500 mt-1">Max 20. Categories are sorted alphabetically.</p>
								</div>
							</div>
						</div>
					)}

					{activeTab === "shipping" && (
						<div className="space-y-8">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Shipping Methods
							</h2>

							{/* Existing methods */}
							<div className="space-y-4">
								{(settings.shipping_methods || []).length === 0 && (
									<p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">
										No shipping methods yet. Add one below.
									</p>
								)}
								{(settings.shipping_methods || []).map((method, index) => (
									<div
										key={method.id}
										className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
										<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
											<div className="md:col-span-1">
												<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
													Method Name
												</label>
												<input
													type="text"
													value={method.name}
													onChange={(e) => updateShippingMethod(index, "name", e.target.value)}
													className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
													placeholder="e.g. Standard Shipping"
												/>
											</div>
											<div className="md:col-span-2">
												<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
													Description
												</label>
												<input
													type="text"
													value={method.description}
													onChange={(e) => updateShippingMethod(index, "description", e.target.value)}
													className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
													placeholder="e.g. 5-7 business days"
												/>
											</div>
											<div>
												<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
													Price (৳)
												</label>
												<input
													type="number"
													min="0"
													step="1"
													value={method.price}
													onChange={(e) => updateShippingMethod(index, "price", parseFloat(e.target.value) || 0)}
													className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
												/>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<label className="flex items-center gap-2 cursor-pointer">
												<input
													type="checkbox"
													checked={method.is_active}
													onChange={(e) => updateShippingMethod(index, "is_active", e.target.checked)}
													className="w-4 h-4 text-blue-600 border-zinc-300 rounded"
												/>
												<span className="text-sm text-zinc-700 dark:text-zinc-300">Active</span>
											</label>
											<button
												type="button"
												onClick={() => removeShippingMethod(index)}
												className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40">
												Remove
											</button>
										</div>
									</div>
								))}
							</div>

							{/* Add new method */}
							<div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
								<h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
									Add New Method
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
									<div className="md:col-span-1">
										<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
											Method Name *
										</label>
										<input
											type="text"
											value={newMethod.name}
											onChange={(e) => setNewMethod((p) => ({ ...p, name: e.target.value }))}
											className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
											placeholder="e.g. Express Shipping"
										/>
									</div>
									<div className="md:col-span-2">
										<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
											Description
										</label>
										<input
											type="text"
											value={newMethod.description}
											onChange={(e) => setNewMethod((p) => ({ ...p, description: e.target.value }))}
											className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
											placeholder="e.g. 2-3 business days"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
											Price (৳)
										</label>
										<input
											type="number"
											min="0"
											step="1"
											value={newMethod.price}
											onChange={(e) => setNewMethod((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
											className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
										/>
									</div>
								</div>
								<button
									type="button"
									onClick={addShippingMethod}
									className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
									disabled={!newMethod.name.trim()}>
									Add Method
								</button>
							</div>
						</div>
					)}

					{activeTab === "inventory" && (
						<div className="space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Inventory Settings
							</h2>

							<div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										Track Inventory
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Automatically track and deduct stock levels
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.inventory_tracking}
										onChange={(e) =>
											handleChange("inventory_tracking", e.target.checked)
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
								</label>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Low Stock Threshold
								</label>
								<input
									type="number"
									min="0"
									value={settings.low_stock_threshold}
									onChange={(e) =>
										handleChange(
											"low_stock_threshold",
											parseInt(e.target.value) || 0,
										)
									}
									className="w-full max-w-xs px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
								<p className="text-xs text-zinc-500 mt-1">
									Products below this quantity will be marked as low stock
								</p>
							</div>
						</div>
					)}

					{activeTab === "checkout" && (
						<div className="space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Checkout Settings
							</h2>

							<div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										Allow Guest Checkout
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Allow customers to checkout without creating an account
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.allow_guest_checkout}
										onChange={(e) =>
											handleChange("allow_guest_checkout", e.target.checked)
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
								</label>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Order Number Prefix
								</label>
								<input
									type="text"
									maxLength={10}
									value={settings.order_prefix}
									onChange={(e) => handleChange("order_prefix", e.target.value)}
									className="w-full max-w-xs px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
								/>
								<p className="text-xs text-zinc-500 mt-1">
									Example: {settings.order_prefix}-2024-001234
								</p>
							</div>
						</div>
					)}

					{activeTab === "notifications" && (
						<div className="space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Notification Settings
							</h2>

							<div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										New Order Notifications
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Receive email notifications when new orders are placed
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.notify_on_order}
										onChange={(e) =>
											handleChange("notify_on_order", e.target.checked)
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
								</label>
							</div>

							<div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										Low Stock Alerts
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Receive email notifications when products are low in stock
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.notify_on_low_stock}
										onChange={(e) =>
											handleChange("notify_on_low_stock", e.target.checked)
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
								</label>
							</div>
						</div>
					)}

					{activeTab === "social" && (
						<div className="space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Social Media Links
							</h2>

							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Facebook URL
									</label>
									<div className="flex items-center">
										<span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg text-zinc-500">
											<svg
												className="w-5 h-5"
												fill="currentColor"
												viewBox="0 0 24 24">
												<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
											</svg>
										</span>
										<input
											type="url"
											value={settings.social_facebook}
											onChange={(e) =>
												handleChange("social_facebook", e.target.value)
											}
											placeholder="https://facebook.com/yourstore"
											className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Instagram URL
									</label>
									<div className="flex items-center">
										<span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg text-zinc-500">
											<svg
												className="w-5 h-5"
												fill="currentColor"
												viewBox="0 0 24 24">
												<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
											</svg>
										</span>
										<input
											type="url"
											value={settings.social_instagram}
											onChange={(e) =>
												handleChange("social_instagram", e.target.value)
											}
											placeholder="https://instagram.com/yourstore"
											className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Twitter / X URL
									</label>
									<div className="flex items-center">
										<span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg text-zinc-500">
											<svg
												className="w-5 h-5"
												fill="currentColor"
												viewBox="0 0 24 24">
												<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
											</svg>
										</span>
										<input
											type="url"
											value={settings.social_twitter}
											onChange={(e) =>
												handleChange("social_twitter", e.target.value)
											}
											placeholder="https://x.com/yourstore"
											className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										YouTube URL
									</label>
									<div className="flex items-center">
										<span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg text-red-500">
											▶️
										</span>
										<input
											type="url"
											value={settings.social_youtube}
											onChange={(e) =>
												handleChange("social_youtube", e.target.value)
											}
											placeholder="https://youtube.com/@smstech"
											className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										WhatsApp Contact Link / Number
									</label>
									<div className="flex items-center">
										<span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg text-emerald-500">
											💬
										</span>
										<input
											type="text"
											value={settings.social_whatsapp}
											onChange={(e) =>
												handleChange("social_whatsapp", e.target.value)
											}
											placeholder="https://wa.me/8801781485588 or 01781485588"
											className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
