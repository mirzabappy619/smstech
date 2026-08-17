"use client";

import { useState, useEffect, useCallback } from "react";

type MetaEventType =
	| "PageView"
	| "ViewContent"
	| "AddToCart"
	| "InitiateCheckout"
	| "Purchase"
	| "AddPaymentInfo"
	| "Lead"
	| "CompleteRegistration"
	| "Search";

interface MetaPixelSettings {
	pixel_id: string;
	access_token: string | null;
	dataset_id: string | null;
	api_version: string;
	test_event_code: string | null;
	enabled: boolean;
	fire_purchase_on_confirmed: boolean;
	enabled_events: MetaEventType[];
	test_mode: boolean;
}

interface TestResult {
	success: boolean;
	event_name?: string;
	events_received?: number;
	fbtrace_id?: string;
	endpoint?: string;
	error?: string;
	payload?: object;
}

interface EventLog {
	id: string;
	time: string;
	event: string;
	status: "success" | "error";
	message: string;
	fbtrace_id?: string;
}

const EVENT_TYPES: { value: MetaEventType; label: string; description: string }[] = [
	{ value: "PageView", label: "Page View", description: "Track page views across your site" },
	{ value: "ViewContent", label: "View Content", description: "Track when users view product pages" },
	{ value: "AddToCart", label: "Add to Cart", description: "Track add to cart actions" },
	{ value: "InitiateCheckout", label: "Initiate Checkout", description: "Track checkout starts" },
	{ value: "Purchase", label: "Purchase", description: "Track completed purchases (conversion)" },
	{ value: "AddPaymentInfo", label: "Add Payment Info", description: "Track payment info entry" },
	{ value: "Lead", label: "Lead", description: "Track lead generation events" },
	{ value: "CompleteRegistration", label: "Complete Registration", description: "Track registrations" },
	{ value: "Search", label: "Search", description: "Track search queries" },
];

const API_VERSIONS = ["v22.0", "v21.0", "v20.0", "v19.0", "v18.0", "v17.0"];

const DEFAULT_SETTINGS: MetaPixelSettings = {
	pixel_id: "",
	access_token: null,
	dataset_id: null,
	api_version: "v18.0",
	test_event_code: null,
	enabled: false,
	fire_purchase_on_confirmed: false,
	enabled_events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"],
	test_mode: false,
};

export default function MetaPixelPage() {
	const [settings, setSettings] = useState<MetaPixelSettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [activeTab, setActiveTab] = useState<"config" | "capi" | "events">("config");

	// Test panel state
	const [testEvent, setTestEvent] = useState<MetaEventType>("Purchase");
	const [testValue, setTestValue] = useState("10");
	const [testCurrency, setTestCurrency] = useState("BDT");
	const [testEmail, setTestEmail] = useState("");
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<TestResult | null>(null);
	const [showPayload, setShowPayload] = useState(false);

	// Event log (in-session)
	const [eventLog, setEventLog] = useState<EventLog[]>([]);

	// Toast
	const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const showToast = (type: "success" | "error", text: string) => {
		setToast({ type, text });
		setTimeout(() => setToast(null), 4000);
	};

	const fetchSettings = useCallback(async () => {
		try {
			const res = await fetch("/api/v1/admin/meta-pixel");
			const data = await res.json();
			if (data.success && data.data.settings) {
				setSettings({ ...DEFAULT_SETTINGS, ...data.data.settings });
			}
		} catch {
			showToast("error", "Failed to load settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { fetchSettings(); }, [fetchSettings]);

	const handleSave = async () => {
		setSaving(true);
		try {
			const res = await fetch("/api/v1/admin/meta-pixel", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings),
			});
			const data = await res.json();
			if (data.success) {
				showToast("success", "Settings saved successfully");
				if (data.data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.data.settings });
			} else {
				showToast("error", data.error?.message || "Failed to save settings");
			}
		} catch {
			showToast("error", "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	const handleSendTest = async () => {
		setTesting(true);
		setTestResult(null);
		try {
			const res = await fetch("/api/v1/admin/meta-pixel/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					event_name: testEvent,
					value: parseFloat(testValue) || 10,
					currency: testCurrency,
					email: testEmail || undefined,
				}),
			});
			const data = await res.json();
			const logEntry: EventLog = {
				id: crypto.randomUUID(),
				time: new Date().toLocaleTimeString(),
				event: testEvent,
				status: data.success ? "success" : "error",
				message: data.success
					? `Sent ✓ — ${data.data?.events_received ?? 0} event(s) received by Facebook`
					: (data.error?.message || "Facebook API returned an error"),
				fbtrace_id: data.data?.fbtrace_id,
			};
			setEventLog((prev) => [logEntry, ...prev].slice(0, 50));
			if (data.success) {
				setTestResult({ success: true, ...data.data });
				showToast("success", `"${testEvent}" sent to Facebook CAPI ✓`);
			} else {
				setTestResult({ success: false, error: data.error?.message || "Unknown error" });
				showToast("error", data.error?.message || "Failed to send event");
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Network error";
			setTestResult({ success: false, error: msg });
			showToast("error", msg);
		} finally {
			setTesting(false);
		}
	};

	const toggleEvent = (evt: MetaEventType) => {
		setSettings((prev) => ({
			...prev,
			enabled_events: prev.enabled_events.includes(evt)
				? prev.enabled_events.filter((e) => e !== evt)
				: [...prev.enabled_events, evt],
		}));
	};

	const capiEndpoint = `https://graph.facebook.com/${settings.api_version || "v18.0"}/${settings.dataset_id || settings.pixel_id || "{DATASET_ID}"}/events`;

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto">
			{/* Toast */}
			{toast && (
				<div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium transition-all ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
					{toast.type === "success" ? (
						<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
					) : (
						<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
					)}
					{toast.text}
				</div>
			)}

			{/* Header */}
			<div className="flex items-start justify-between mb-8">
				<div>
					<div className="flex items-center gap-3 mb-2">
						<div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
							<svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
							</svg>
						</div>
						<div>
							<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Meta Conversions API</h1>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">Server-side event tracking for Facebook advertising</p>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					{settings.enabled && settings.access_token && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
							<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
							CAPI Active
						</span>
					)}
					{(!settings.enabled || !settings.access_token) && (
						<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
							<span className="w-2 h-2 rounded-full bg-zinc-400" />
							Inactive
						</span>
					)}
					<button
						onClick={handleSave}
						disabled={saving || !settings.pixel_id}
						className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
					>
						{saving ? (
							<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
						) : (
							<><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Save Settings</>
						)}
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 mb-6 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
				{(["config", "capi", "events"] as const).map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
					>
						{tab === "config" ? "⚙️ Configuration" : tab === "capi" ? "🚀 Test & Debug" : "📋 Event Log"}
					</button>
				))}
			</div>

			{/* ─── Tab: Configuration ─── */}
			{activeTab === "config" && (
				<div className="space-y-6">
					{/* Pixel / Dataset Configuration */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Pixel & CAPI Configuration</h2>
						<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Enter your Facebook Pixel ID and Conversions API (CAPI) credentials.</p>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
									Pixel ID <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									value={settings.pixel_id}
									onChange={(e) => setSettings({ ...settings, pixel_id: e.target.value })}
									placeholder="e.g. 1234567890123456"
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<p className="text-xs text-zinc-500 mt-1">From Meta Events Manager → Data Sources</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
									Dataset ID
									<span className="ml-2 text-xs text-zinc-400 font-normal">(leave blank to use Pixel ID)</span>
								</label>
								<input
									type="text"
									value={settings.dataset_id || ""}
									onChange={(e) => setSettings({ ...settings, dataset_id: e.target.value || null })}
									placeholder="Same as Pixel ID by default"
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<p className="text-xs text-zinc-500 mt-1">The {"{DATASET_ID}"} in the CAPI endpoint URL</p>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
									Conversions API Access Token <span className="text-red-500">*</span>
								</label>
								<div className="relative">
									<input
										type="password"
										value={settings.access_token || ""}
										onChange={(e) => setSettings({ ...settings, access_token: e.target.value || null })}
										placeholder="EAAMo8XZBkrIk..."
										className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
									{settings.access_token && (
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium">✓ Set</span>
									)}
								</div>
								<p className="text-xs text-zinc-500 mt-1">Generate in Meta Events Manager → Settings → Conversions API → Generate Access Token</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">API Version</label>
								<select
									value={settings.api_version || "v18.0"}
									onChange={(e) => setSettings({ ...settings, api_version: e.target.value })}
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									{API_VERSIONS.map((v) => (
										<option key={v} value={v}>{v}</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
									Test Event Code
									<span className="ml-2 text-xs text-zinc-400 font-normal">(for test mode)</span>
								</label>
								<input
									type="text"
									value={settings.test_event_code || ""}
									onChange={(e) => setSettings({ ...settings, test_event_code: e.target.value || null })}
									placeholder="e.g. TEST12345"
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<p className="text-xs text-zinc-500 mt-1">From Meta Events Manager → Test Events tab</p>
							</div>
						</div>

						{/* Computed endpoint preview */}
						<div className="mt-5 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
							<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">CAPI Endpoint (computed)</p>
							<code className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{capiEndpoint}</code>
						</div>
					</div>

					{/* Toggles */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-5">Behaviour Settings</h2>
						<div className="space-y-4">
							{[
								{ id: "enabled", label: "Enable CAPI tracking", desc: "Send server-side conversion events to Facebook", key: "enabled" as const },
								{ id: "fire_purchase", label: "Auto-fire Purchase on order confirmed", desc: "When admin marks an order as \"confirmed\", fire a Purchase event", key: "fire_purchase_on_confirmed" as const },
								{ id: "test_mode", label: "Test mode", desc: "Uses your Test Event Code so events appear under Test Events in Meta Events Manager", key: "test_mode" as const },
							].map((item) => (
								<label key={item.id} className="flex items-start gap-4 cursor-pointer group">
									<div className="relative mt-0.5 flex-shrink-0">
										<input
											type="checkbox"
											id={item.id}
											checked={settings[item.key] as boolean}
											onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
											className="sr-only"
										/>
										<div className={`w-11 h-6 rounded-full transition-colors ${settings[item.key] ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-600"}`}>
											<div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[item.key] ? "translate-x-5" : "translate-x-0.5"}`} />
										</div>
									</div>
									<div>
										<p className="text-sm font-medium text-zinc-900 dark:text-white">{item.label}</p>
										<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</p>
									</div>
								</label>
							))}
						</div>
					</div>

					{/* Events */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Enabled Events</h2>
						<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Select which standard Facebook events to track via CAPI</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{EVENT_TYPES.map((et) => {
								const active = settings.enabled_events.includes(et.value);
								return (
									<label key={et.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${active ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}>
										<input type="checkbox" checked={active} onChange={() => toggleEvent(et.value)} className="sr-only" />
										<div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${active ? "border-blue-500 bg-blue-500" : "border-zinc-400"}`}>
											{active && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
										</div>
										<div>
											<p className="text-sm font-medium text-zinc-900 dark:text-white leading-tight">{et.label}</p>
											<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">{et.description}</p>
										</div>
									</label>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* ─── Tab: Test & Debug ─── */}
			{activeTab === "capi" && (
				<div className="space-y-6">
					{/* Status Card */}
					<div className={`rounded-2xl border-2 p-5 flex items-start gap-4 ${settings.access_token && settings.pixel_id ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"}`}>
						<div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${settings.access_token && settings.pixel_id ? "bg-emerald-600" : "bg-amber-500"}`}>
							{settings.access_token && settings.pixel_id ? (
								<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
							) : (
								<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
							)}
						</div>
						<div className="flex-1">
							<p className="font-semibold text-zinc-900 dark:text-white mb-1">
								{settings.access_token && settings.pixel_id ? "CAPI is configured and ready" : "CAPI not fully configured"}
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
								<span>Pixel/Dataset ID: <strong className="text-zinc-900 dark:text-white">{settings.dataset_id || settings.pixel_id || "Not set"}</strong></span>
								<span>API Version: <strong className="text-zinc-900 dark:text-white">{settings.api_version || "v18.0"}</strong></span>
								<span>Access Token: <strong className="text-zinc-900 dark:text-white">{settings.access_token ? "✓ Configured" : "✗ Missing"}</strong></span>
								<span>Mode: <strong className="text-zinc-900 dark:text-white">{settings.test_mode ? "🧪 Test Mode" : "🟢 Live"}</strong></span>
							</div>
						</div>
					</div>

					{/* Endpoint Preview */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Your CAPI Endpoint</h2>
						<div className="bg-zinc-950 rounded-xl p-4">
							<p className="text-xs text-zinc-500 mb-2 font-mono uppercase">POST</p>
							<p className="text-sm text-emerald-400 font-mono break-all">{capiEndpoint}</p>
							<p className="text-xs text-zinc-500 mt-3 font-mono">?access_token=<span className="text-blue-400">{settings.access_token ? settings.access_token.slice(0, 20) + "…" : "{YOUR_TOKEN}"}</span></p>
						</div>
					</div>

					{/* Test Event Sender */}
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Send Test Event</h2>
						<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">Fire a test conversion event directly to Facebook Conversions API from the server.</p>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
							<div>
								<label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Event Name</label>
								<select
									value={testEvent}
									onChange={(e) => setTestEvent(e.target.value as MetaEventType)}
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									{EVENT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
								</select>
							</div>
							<div>
								<label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Value</label>
								<input
									type="number"
									value={testValue}
									onChange={(e) => setTestValue(e.target.value)}
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Currency</label>
								<input
									type="text"
									value={testCurrency}
									onChange={(e) => setTestCurrency(e.target.value.toUpperCase())}
									maxLength={3}
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Test Email (hashed)</label>
								<input
									type="email"
									value={testEmail}
									onChange={(e) => setTestEmail(e.target.value)}
									placeholder="user@example.com"
									className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>

						<button
							onClick={handleSendTest}
							disabled={testing || !settings.access_token || !settings.pixel_id}
							className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
						>
							{testing ? (
								<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
							) : (
								<><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Send Test Event</>
							)}
						</button>
						{!settings.access_token && (
							<p className="text-xs text-amber-600 dark:text-amber-400 mt-2">⚠ Save an access token in Configuration first</p>
						)}

						{/* Result */}
						{testResult && (
							<div className={`mt-5 rounded-xl border p-4 ${testResult.success ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"}`}>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										{testResult.success ? (
											<><span className="text-lg">✅</span><span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Event accepted by Facebook</span></>
										) : (
											<><span className="text-lg">❌</span><span className="text-sm font-medium text-red-800 dark:text-red-300">Facebook returned an error</span></>
										)}
									</div>
									{testResult.payload && (
										<button onClick={() => setShowPayload((p) => !p)} className="text-xs text-zinc-500 underline">
											{showPayload ? "Hide" : "Show"} payload
										</button>
									)}
								</div>
								<div className="text-xs space-y-1">
									{testResult.success ? (
										<>
											<p><span className="text-zinc-500">Events received:</span> <strong className="text-emerald-700 dark:text-emerald-400">{testResult.events_received}</strong></p>
											{testResult.fbtrace_id && <p><span className="text-zinc-500">Trace ID:</span> <code className="text-zinc-700 dark:text-zinc-300">{testResult.fbtrace_id}</code></p>}
											<p><span className="text-zinc-500">Endpoint:</span> <code className="text-blue-600 dark:text-blue-400 break-all">{testResult.endpoint}</code></p>
										</>
									) : (
										<p className="text-red-700 dark:text-red-400">{testResult.error}</p>
									)}
								</div>
								{showPayload && testResult.payload && (
									<pre className="mt-3 text-xs bg-zinc-900 text-green-400 rounded-lg p-3 overflow-x-auto">
										{JSON.stringify(testResult.payload, null, 2)}
									</pre>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* ─── Tab: Event Log ─── */}
			{activeTab === "events" && (
				<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between mb-5">
						<div>
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Session Event Log</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">Events sent during this admin session</p>
						</div>
						{eventLog.length > 0 && (
							<button onClick={() => setEventLog([])} className="text-xs text-zinc-500 hover:text-red-500 transition-colors">Clear</button>
						)}
					</div>
					{eventLog.length === 0 ? (
						<div className="text-center py-16 text-zinc-400">
							<svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
							<p className="text-sm">No events sent yet.<br />Use the "Test &amp; Debug" tab to send a test event.</p>
						</div>
					) : (
						<div className="space-y-2">
							{eventLog.map((log) => (
								<div key={log.id} className={`flex items-start gap-4 p-4 rounded-xl border ${log.status === "success" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/10" : "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/10"}`}>
									<span className="text-lg flex-shrink-0 mt-0.5">{log.status === "success" ? "✅" : "❌"}</span>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 flex-wrap">
											<span className="text-sm font-semibold text-zinc-900 dark:text-white">{log.event}</span>
											<span className="text-xs text-zinc-500">{log.time}</span>
										</div>
										<p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{log.message}</p>
										{log.fbtrace_id && <p className="text-xs text-zinc-400 mt-0.5 font-mono">trace: {log.fbtrace_id}</p>}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
