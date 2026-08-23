"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE, normalizeBDPhone } from "@/lib/bd-phone-validator";
import { FraudCheckResult, getRiskLevelConfig } from "@/lib/fraud-check";

interface CourierSettings {
	id?: string;
	pathao_client_id: string;
	pathao_client_secret: string;
	pathao_username: string;
	pathao_password: string;
	pathao_default_store_id: number | null;
	pathao_environment: "sandbox" | "production";
	steadfast_api_key: string;
	steadfast_secret_key: string;
	default_provider: "none" | "pathao" | "steadfast";
	is_active: boolean;
}

interface CourierDelivery {
	id: string;
	order_number: string;
	total: number;
	payment_status: string;
	status: string;
	shipping_address: any;
	courier_provider: string;
	courier_consignment_id: string;
	courier_tracking_code: string | null;
	courier_status: string | null;
	courier_delivery_fee: number | null;
	courier_data: any;
	courier_sent_at: string;
	created_at: string;
}

interface DeliveryStats {
	totalSent: number;
	pathaoCount: number;
	steadfastCount: number;
	pendingCount: number;
	deliveredCount: number;
	cancelledCount: number;
	totalDeliveryFees: number;
}

interface LocationOption {
	id: number;
	name: string;
}

const defaultSettings: CourierSettings = {
	pathao_client_id: "",
	pathao_client_secret: "",
	pathao_username: "",
	pathao_password: "",
	pathao_default_store_id: 388178,
	pathao_environment: "production",
	steadfast_api_key: "",
	steadfast_secret_key: "",
	default_provider: "none",
	is_active: false,
};

export default function CourierSettingsPage() {
	const [settings, setSettings] = useState<CourierSettings>(defaultSettings);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("deliveries");

	// Connection test state
	const [testingPathao, setTestingPathao] = useState(false);
	const [testingSteadfast, setTestingSteadfast] = useState(false);
	const [pathaoStores, setPathaoStores] = useState<
		Array<{ store_id: number; store_name: string }>
	>([]);
	const [pathaoConnected, setPathaoConnected] = useState(false);
	const [steadfastConnected, setSteadfastConnected] = useState(false);
	const [storeSearchFilter, setStoreSearchFilter] = useState("");

	// Deliveries Dashboard state
	const [deliveries, setDeliveries] = useState<CourierDelivery[]>([]);
	const [stats, setStats] = useState<DeliveryStats>({
		totalSent: 0,
		pathaoCount: 0,
		steadfastCount: 0,
		pendingCount: 0,
		deliveredCount: 0,
		cancelledCount: 0,
		totalDeliveryFees: 0,
	});
	const [deliveriesLoading, setDeliveriesLoading] = useState(false);
	const [deliverySearch, setDeliverySearch] = useState("");
	const [providerFilter, setProviderFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [refreshingOrderId, setRefreshingOrderId] = useState<string | null>(null);
	const [syncingAll, setSyncingAll] = useState(false);

	// Raw JSON Modal state
	const [rawModalData, setRawModalData] = useState<{
		orderNumber: string;
		provider: string;
		data: any;
	} | null>(null);

	// Create Delivery Form state
	const [createStoreId, setCreateStoreId] = useState<number | null>(null);
	const [createItemType, setCreateItemType] = useState<number>(2); // 2 = Parcel, 1 = Document
	const [createMerchantOrderId, setCreateMerchantOrderId] = useState("");
	const [createRecipientPhone, setCreateRecipientPhone] = useState("");
	const [createRecipientSecondaryPhone, setCreateRecipientSecondaryPhone] = useState("");
	const [createRecipientName, setCreateRecipientName] = useState("");
	const [createRecipientAddress, setCreateRecipientAddress] = useState("");
	const [createDeliveryType, setCreateDeliveryType] = useState<number>(48); // 48 = Normal, 12 = On Demand
	const [createWeight, setCreateWeight] = useState<number>(0.5);
	const [createQuantity, setCreateQuantity] = useState<number>(1);
	const [createAmountToCollect, setCreateAmountToCollect] = useState<number>(0);
	const [createItemDescription, setCreateItemDescription] = useState("");
	const [createSpecialInstruction, setCreateSpecialInstruction] = useState("");

	// Location cascades for Form
	const [cities, setCities] = useState<LocationOption[]>([]);
	const [zones, setZones] = useState<LocationOption[]>([]);
	const [areas, setAreas] = useState<LocationOption[]>([]);
	const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
	const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
	const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

	// Price Calculation state
	const [calculatedPrice, setCalculatedPrice] = useState<{
		price: number;
		codFee: number;
		finalPrice: number;
	} | null>(null);
	const [calculatingPrice, setCalculatingPrice] = useState(false);
	const [submittingOrder, setSubmittingOrder] = useState(false);

	// Fraud check in Direct Delivery Form
	const [courierFormFraudResult, setCourierFormFraudResult] = useState<FraudCheckResult | null>(null);
	const [courierFormFraudLoading, setCourierFormFraudLoading] = useState(false);

	const checkCourierPhoneFraud = async (targetPhone?: string) => {
		const rawPhone = targetPhone || createRecipientPhone;
		const normalized = normalizeBDPhone(rawPhone);
		if (!normalized || !isValidBDPhone(normalized)) {
			setCourierFormFraudResult(null);
			return;
		}
		setCourierFormFraudLoading(true);
		try {
			const res = await fetch(`/api/v1/fraud-check?phone=${encodeURIComponent(normalized)}`);
			const data = await res.json();
			if (data.success) {
				setCourierFormFraudResult(data);
			} else {
				setCourierFormFraudResult(null);
			}
		} catch {
			setCourierFormFraudResult(null);
		} finally {
			setCourierFormFraudLoading(false);
		}
	};

	// Standalone Fraud Check tab state
	const [tabFraudPhone, setTabFraudPhone] = useState("01712345678");
	const [tabFraudResult, setTabFraudResult] = useState<FraudCheckResult | null>(null);
	const [tabFraudLoading, setTabFraudLoading] = useState(false);
	const [tabFraudError, setTabFraudError] = useState<string | null>(null);

	const runTabFraudCheck = async (targetPhone?: string) => {
		const searchPhone = targetPhone || tabFraudPhone;
		const normalized = normalizeBDPhone(searchPhone);
		if (!normalized || !isValidBDPhone(normalized)) {
			setTabFraudError(BD_PHONE_ERROR_MESSAGE);
			return;
		}
		setTabFraudError(null);
		setTabFraudLoading(true);
		try {
			const res = await fetch(`/api/v1/fraud-check?phone=${encodeURIComponent(normalized)}`);
			const data = await res.json();
			if (data.success) {
				setTabFraudResult(data);
			} else {
				setTabFraudError(data.error || "Failed to fetch fraud check data");
				setTabFraudResult(null);
			}
		} catch (err: any) {
			setTabFraudError(err.message || "Failed to connect to fraud check service");
			setTabFraudResult(null);
		} finally {
			setTabFraudLoading(false);
		}
	};

	const fetchSettings = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/v1/admin/courier/settings", {
				credentials: "include",
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error?.message || "Failed to fetch settings",
				);
			}
			const result = await response.json();
			const raw = result.data;
			if (raw) {
				setSettings({
					id: raw.id,
					pathao_client_id: raw.pathao_client_id || "",
					pathao_client_secret: raw.pathao_client_secret || "",
					pathao_username: raw.pathao_username || "",
					pathao_password: raw.pathao_password || "",
					pathao_default_store_id: raw.pathao_default_store_id || 388178,
					pathao_environment: raw.pathao_environment || "production",
					steadfast_api_key: raw.steadfast_api_key || "",
					steadfast_secret_key: raw.steadfast_secret_key || "",
					default_provider: raw.default_provider || "none",
					is_active: raw.is_active || false,
				});
				setCreateStoreId(raw.pathao_default_store_id || 388178);
				if (raw.pathao_access_token) {
					setPathaoConnected(true);
				}
				if (raw.steadfast_api_key) {
					setSteadfastConnected(true);
				}
			}
		} catch (err) {
			console.error("Error fetching settings:", err);
			setError(
				err instanceof Error ? err.message : "Failed to load settings",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchDeliveries = useCallback(async () => {
		setDeliveriesLoading(true);
		try {
			const params = new URLSearchParams();
			if (deliverySearch) params.set("search", deliverySearch);
			if (providerFilter !== "all") params.set("provider", providerFilter);
			if (statusFilter !== "all") params.set("status", statusFilter);

			const response = await fetch(`/api/v1/admin/courier/deliveries?${params.toString()}`, {
				credentials: "include",
			});
			const json = await response.json();
			if (json.success && json.data) {
				setDeliveries(json.data.deliveries || []);
				if (json.data.stats) {
					setStats(json.data.stats);
				}
			}
		} catch (err) {
			console.error("Error fetching deliveries:", err);
		} finally {
			setDeliveriesLoading(false);
		}
	}, [deliverySearch, providerFilter, statusFilter]);

	// Fetch stores & cities for Create Delivery tab
	const loadFormInitialData = useCallback(async () => {
		try {
			// Load Stores
			const storesRes = await fetch("/api/v1/admin/courier/pathao/stores", { credentials: "include" });
			const storesJson = await storesRes.json();
			if (storesJson.success && storesJson.data) {
				const storeList = Array.isArray(storesJson.data.data) ? storesJson.data.data : Array.isArray(storesJson.data) ? storesJson.data : [];
				setPathaoStores(storeList);
				const targetStore = storeList.find((s: any) => s.store_id === 388178) || storeList.find((s: any) => s.store_name?.toLowerCase().includes("sms") || s.store_name?.toLowerCase().includes("gizmo")) || storeList[0];
				const selectedId = targetStore ? targetStore.store_id : 388178;
				setCreateStoreId(selectedId);
				setSettings(prev => ({ ...prev, pathao_default_store_id: selectedId }));
			}

			// Load Cities
			const citiesRes = await fetch("/api/v1/admin/courier/pathao/cities", { credentials: "include" });
			const citiesJson = await citiesRes.json();
			if (citiesJson.success && citiesJson.data) {
				const cityList = Array.isArray(citiesJson.data.data) ? citiesJson.data.data : Array.isArray(citiesJson.data) ? citiesJson.data : [];
				setCities(cityList.map((c: any) => ({ id: c.city_id, name: c.city_name })));
			}
		} catch (err) {
			console.error("Error loading form initial data:", err);
		}
	}, [createStoreId]);

	// Fetch zones when city changes
	useEffect(() => {
		if (!selectedCityId) {
			setZones([]);
			setSelectedZoneId(null);
			return;
		}
		async function loadZones() {
			try {
				const res = await fetch(`/api/v1/admin/courier/pathao/zones/${selectedCityId}`, { credentials: "include" });
				const json = await res.json();
				if (json.success && json.data) {
					const list = Array.isArray(json.data.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
					setZones(list.map((z: any) => ({ id: z.zone_id, name: z.zone_name })));
					setSelectedZoneId(null);
				}
			} catch (err) {
				console.error("Error loading zones:", err);
			}
		}
		loadZones();
	}, [selectedCityId]);

	// Fetch areas when zone changes
	useEffect(() => {
		if (!selectedZoneId) {
			setAreas([]);
			setSelectedAreaId(null);
			return;
		}
		async function loadAreas() {
			try {
				const res = await fetch(`/api/v1/admin/courier/pathao/areas/${selectedZoneId}`, { credentials: "include" });
				const json = await res.json();
				if (json.success && json.data) {
					const list = Array.isArray(json.data.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
					setAreas(list.map((a: any) => ({ id: a.area_id, name: a.area_name })));
					setSelectedAreaId(null);
				}
			} catch (err) {
				console.error("Error loading areas:", err);
			}
		}
		loadAreas();
	}, [selectedZoneId]);

	// Live price calculation when params change
	useEffect(() => {
		if (!createStoreId || !selectedCityId || !selectedZoneId) {
			setCalculatedPrice(null);
			return;
		}

		async function calcPrice() {
			setCalculatingPrice(true);
			try {
				const res = await fetch("/api/v1/admin/courier/pathao/price", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						store_id: createStoreId,
						item_type: createItemType,
						delivery_type: createDeliveryType,
						item_weight: createWeight,
						recipient_city: selectedCityId,
						recipient_zone: selectedZoneId,
					}),
				});
				const json = await res.json();
				if (json.success && json.data) {
					const priceData = json.data;
					const basePrice = Number(priceData.price || priceData.final_price || 60);
					const codRate = Number(priceData.cod_percentage || 0);
					const codFee = Math.round(createAmountToCollect * codRate);
					setCalculatedPrice({
						price: basePrice,
						codFee,
						finalPrice: basePrice + codFee,
					});
				}
			} catch (err) {
				console.error("Price calc error:", err);
			} finally {
				setCalculatingPrice(false);
			}
		}

		const debounceTimer = setTimeout(calcPrice, 400);
		return () => clearTimeout(debounceTimer);
	}, [createStoreId, createItemType, createDeliveryType, createWeight, selectedCityId, selectedZoneId, createAmountToCollect]);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	useEffect(() => {
		if (activeTab === "deliveries") {
			fetchDeliveries();
		} else if (activeTab === "create_delivery") {
			loadFormInitialData();
		}
	}, [activeTab, fetchDeliveries, loadFormInitialData]);

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			const response = await fetch("/api/v1/admin/courier/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					pathao_client_id: settings.pathao_client_id || null,
					pathao_client_secret: settings.pathao_client_secret || null,
					pathao_username: settings.pathao_username || null,
					pathao_password: settings.pathao_password || null,
					pathao_default_store_id: settings.pathao_default_store_id,
					pathao_environment: settings.pathao_environment,
					steadfast_api_key: settings.steadfast_api_key || null,
					steadfast_secret_key: settings.steadfast_secret_key || null,
					default_provider: settings.default_provider,
					is_active: settings.is_active,
				}),
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error?.message || "Failed to save settings",
				);
			}
			setSuccess("Settings saved successfully!");
			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			console.error("Error saving settings:", err);
			setError(
				err instanceof Error ? err.message : "Failed to save settings",
			);
		} finally {
			setSaving(false);
		}
	};

	const testPathaoConnection = async () => {
		setTestingPathao(true);
		setError(null);
		setSuccess(null);
		try {
			await handleSave();
			const response = await fetch("/api/v1/admin/courier/pathao/stores", {
				credentials: "include",
			});
			const data = await response.json();
			if (!response.ok || !data.success) {
				throw new Error(
					data.error?.message || "Pathao connection failed",
				);
			}
			const stores: Array<{ store_id: number; store_name: string }> = Array.isArray(data.data?.data)
				? data.data.data
				: Array.isArray(data.data)
					? data.data
					: [];
			
			setSuccess("Pathao connection successful!");
			setPathaoStores(stores);
			setPathaoConnected(true);

			const targetStore = stores.find(s => s.store_id === 388178) || stores.find(s => s.store_name?.toLowerCase().includes("sms") || s.store_name?.toLowerCase().includes("gizmo")) || stores[0];
			const selectedId = targetStore ? targetStore.store_id : 388178;
			setCreateStoreId(selectedId);
			setSettings(prev => ({ ...prev, pathao_default_store_id: selectedId }));

			setTimeout(() => setSuccess(null), 3000);
		} catch (err) {
			setPathaoConnected(false);
			setError(
				err instanceof Error
					? err.message
					: "Pathao connection failed",
			);
		} finally {
			setTestingPathao(false);
		}
	};

	const testSteadfastConnection = async () => {
		setTestingSteadfast(true);
		setError(null);
		setSuccess(null);
		try {
			await handleSave();
			const response = await fetch(
				"/api/v1/admin/courier/steadfast/balance",
				{
					credentials: "include",
				},
			);
			const data = await response.json();
			if (!response.ok || !data.success) {
				throw new Error(
					data.error?.message || "Steadfast connection failed",
				);
			}
			setSuccess(
				`Steadfast connection successful! Current balance: ৳${data.data?.current_balance || 0}`,
			);
			setSteadfastConnected(true);
			setTimeout(() => setSuccess(null), 5000);
		} catch (err) {
			setSteadfastConnected(false);
			setError(
				err instanceof Error
					? err.message
					: "Steadfast connection failed",
			);
		} finally {
			setTestingSteadfast(false);
		}
	};

	const submitDirectOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!createStoreId) {
			alert("Please select a store");
			return;
		}
		if (!createRecipientName || !createRecipientPhone || !createRecipientAddress) {
			alert("Please fill out recipient name, phone, and address");
			return;
		}

		if (!isValidBDPhone(createRecipientPhone)) {
			alert(BD_PHONE_ERROR_MESSAGE);
			return;
		}

		if (createRecipientSecondaryPhone && !isValidBDPhone(createRecipientSecondaryPhone)) {
			alert("Secondary phone: " + BD_PHONE_ERROR_MESSAGE);
			return;
		}

		setSubmittingOrder(true);
		setError(null);
		setSuccess(null);

		try {
			const res = await fetch("/api/v1/admin/courier/pathao/create-direct-order", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					store_id: createStoreId,
					merchant_order_id: createMerchantOrderId || undefined,
					recipient_name: createRecipientName,
					recipient_phone: createRecipientPhone,
					recipient_secondary_phone: createRecipientSecondaryPhone || undefined,
					recipient_address: createRecipientAddress,
					recipient_city: selectedCityId || undefined,
					recipient_zone: selectedZoneId || undefined,
					recipient_area: selectedAreaId || undefined,
					delivery_type: createDeliveryType,
					item_type: createItemType,
					special_instruction: createSpecialInstruction || undefined,
					item_quantity: createQuantity,
					item_weight: createWeight,
					item_description: createItemDescription || undefined,
					amount_to_collect: createAmountToCollect,
				}),
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				console.error("🔴 Pathao direct delivery UI submission error response:\n", JSON.stringify(json, null, 2));
				let detailMsg = json.error?.message || "Failed to create Pathao delivery";
				if (json.error?.details && typeof json.error.details === "object") {
					const detailStr = Object.entries(json.error.details)
						.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
						.join("; ");
					if (detailStr) detailMsg += ` (${detailStr})`;
				}
				throw new Error(detailMsg);
			}

			const consignmentId = json.data?.consignment_id || json.data?.data?.consignment_id || "Created";
			setSuccess(`Delivery Created Successfully! Consignment ID: ${consignmentId}`);
			
			// Reset form
			setCreateRecipientName("");
			setCreateRecipientPhone("");
			setCreateRecipientSecondaryPhone("");
			setCreateRecipientAddress("");
			setCreateMerchantOrderId("");
			setCreateAmountToCollect(0);
			setCreateItemDescription("");
			setCreateSpecialInstruction("");

			// Switch to deliveries tab after 2s
			setTimeout(() => {
				setActiveTab("deliveries");
				fetchDeliveries();
			}, 1500);

		} catch (err: any) {
			setError(err.message || "Failed to create delivery");
		} finally {
			setSubmittingOrder(false);
		}
	};

	const refreshSingleStatus = async (orderId: string) => {
		setRefreshingOrderId(orderId);
		try {
			const res = await fetch(`/api/v1/admin/courier/status/${orderId}`, {
				credentials: "include",
			});
			const json = await res.json();
			if (json.success) {
				fetchDeliveries();
			} else {
				alert(`Failed to refresh status: ${json.error?.message || "Unknown error"}`);
			}
		} catch (err: any) {
			alert(`Error refreshing status: ${err.message}`);
		} finally {
			setRefreshingOrderId(null);
		}
	};

	const syncAllStatuses = async () => {
		setSyncingAll(true);
		try {
			const res = await fetch(`/api/v1/admin/courier/sync-all`, {
				method: "POST",
				credentials: "include",
			});
			const json = await res.json();
			if (json.success) {
				setSuccess(`Successfully synced ${json.data.updatedCount} of ${json.data.totalSynced} active deliveries!`);
				fetchDeliveries();
				setTimeout(() => setSuccess(null), 4000);
			}
		} catch (err: any) {
			setError(`Failed to sync statuses: ${err.message}`);
		} finally {
			setSyncingAll(false);
		}
	};

	const getStatusBadge = (status: string | null) => {
		if (!status) return <span className="px-2.5 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">Unknown</span>;
		const s = status.toLowerCase();
		if (s.includes("delivered")) {
			return <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 font-semibold">{status}</span>;
		}
		if (s.includes("cancel") || s.includes("return")) {
			return <span className="px-2.5 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-semibold">{status}</span>;
		}
		if (s.includes("transit") || s.includes("dispatch") || s.includes("ship")) {
			return <span className="px-2.5 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-semibold">{status}</span>;
		}
		return <span className="px-2.5 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold">{status}</span>;
	};

	const tabs = [
		{
			id: "deliveries",
			label: "Deliveries & Tracking",
			icon: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
		},
		{
			id: "create_delivery",
			label: "Create Pathao Delivery",
			icon: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
		},
		{
			id: "fraud_check",
			label: "Phone Fraud Check",
			icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
		},
		{
			id: "pathao",
			label: "Pathao Settings",
			icon: "M13 10V3L4 14h7v7l9-11h-7z",
		},
		{
			id: "steadfast",
			label: "Steadfast Settings",
			icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
		},
	];

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48 animate-pulse" />
				<div className="flex gap-6">
					<div className="w-48 space-y-2">
						{[...Array(4)].map((_, i) => (
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
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
						Courier Integration & Deliveries
						{settings.is_active ? (
							<span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
								Active
							</span>
						) : (
							<span className="px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 rounded-full">
								Disabled
							</span>
						)}
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">
						Manage Pathao & Steadfast integrations, dispatch direct deliveries, track live status, and inspect API data
					</p>
				</div>
			</div>

			{error && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-red-400 mr-2 flex-shrink-0"
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
						<span className="text-red-700 dark:text-red-300 font-medium">{error}</span>
					</div>
				</div>
			)}

			{success && (
				<div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0"
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
						<span className="text-emerald-700 dark:text-emerald-300 font-medium">
							{success}
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-col lg:flex-row gap-6">
				{/* Sidebar Navigation */}
				<div className="w-full lg:w-60 space-y-1">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
								activeTab === tab.id
									? "bg-blue-600 text-white shadow-sm"
									: "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
							}`}>
							<svg
								className="w-5 h-5 flex-shrink-0"
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
				<div className="flex-1 space-y-6">
					{/* ================= Deliveries & Tracking Tab ================= */}
					{activeTab === "deliveries" && (
						<div className="space-y-6">
							{/* Overview Stats Cards */}
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Sent</p>
									<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{stats.totalSent}</p>
								</div>
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending</p>
									<p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pendingCount}</p>
								</div>
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Delivered</p>
									<p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.deliveredCount}</p>
								</div>
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-red-600 dark:text-red-400">Cancelled / Ret.</p>
									<p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.cancelledCount}</p>
								</div>
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-blue-600 dark:text-blue-400">Pathao / Steadfast</p>
									<p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">
										<span className="text-blue-600">{stats.pathaoCount}</span> / <span className="text-emerald-600">{stats.steadfastCount}</span>
									</p>
								</div>
								<div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
									<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Fees</p>
									<p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">৳{stats.totalDeliveryFees.toFixed(2)}</p>
								</div>
							</div>

							{/* Filter Controls & Sync All */}
							<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
								<div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
									<input
										type="text"
										placeholder="Search by Order #, Consignment ID, Tracking Code..."
										value={deliverySearch}
										onChange={(e) => setDeliverySearch(e.target.value)}
										className="px-3.5 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 min-w-[260px]"
									/>
									<select
										value={providerFilter}
										onChange={(e) => setProviderFilter(e.target.value)}
										className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										<option value="all">All Providers</option>
										<option value="pathao">Pathao</option>
										<option value="steadfast">Steadfast</option>
									</select>
									<select
										value={statusFilter}
										onChange={(e) => setStatusFilter(e.target.value)}
										className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										<option value="all">All Statuses</option>
										<option value="pending">Pending</option>
										<option value="delivered">Delivered</option>
										<option value="cancelled">Cancelled</option>
									</select>
								</div>

								<button
									onClick={syncAllStatuses}
									disabled={syncingAll}
									className="w-full sm:w-auto px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
									{syncingAll ? (
										<>
											<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
											</svg>
											Syncing All...
										</>
									) : (
										<>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
											</svg>
											Sync All Active Deliveries
										</>
									)}
								</button>
							</div>

							{/* Deliveries Table */}
							<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
								{deliveriesLoading ? (
									<div className="p-8 text-center text-zinc-500 dark:text-zinc-400 space-y-2">
										<div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
										<p className="text-sm">Loading courier deliveries...</p>
									</div>
								) : deliveries.length === 0 ? (
									<div className="p-12 text-center text-zinc-500 dark:text-zinc-400 space-y-3">
										<svg className="w-12 h-12 mx-auto text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
										</svg>
										<p className="font-semibold text-zinc-900 dark:text-white">No Courier Deliveries Found</p>
										<p className="text-sm">Dispatch orders to Pathao or Steadfast from the Order Detail page or create a direct delivery.</p>
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-left border-collapse text-sm">
											<thead>
												<tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
													<th className="py-3.5 px-4">Order #</th>
													<th className="py-3.5 px-4">Provider</th>
													<th className="py-3.5 px-4">Consignment ID</th>
													<th className="py-3.5 px-4">Tracking Code</th>
													<th className="py-3.5 px-4">Status</th>
													<th className="py-3.5 px-4">Delivery Fee</th>
													<th className="py-3.5 px-4">Sent Date</th>
													<th className="py-3.5 px-4 text-right">Actions</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
												{deliveries.map((item) => (
													<tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
														<td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-white">
															<Link href={`/admin/orders/${item.id}`} className="hover:text-blue-600 underline decoration-dotted">
																{item.order_number}
															</Link>
														</td>
														<td className="py-3.5 px-4">
															{item.courier_provider === "pathao" ? (
																<span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
																	Pathao
																</span>
															) : (
																<span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full">
																	Steadfast
																</span>
															)}
														</td>
														<td className="py-3.5 px-4 font-mono text-xs text-zinc-800 dark:text-zinc-200">
															{item.courier_consignment_id}
														</td>
														<td className="py-3.5 px-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
															{item.courier_tracking_code || "N/A"}
														</td>
														<td className="py-3.5 px-4">
															{getStatusBadge(item.courier_status)}
														</td>
														<td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-white">
															{item.courier_delivery_fee !== null ? `৳${Number(item.courier_delivery_fee).toFixed(2)}` : "—"}
														</td>
														<td className="py-3.5 px-4 text-xs text-zinc-500 dark:text-zinc-400">
															{item.courier_sent_at ? new Date(item.courier_sent_at).toLocaleString() : "—"}
														</td>
														<td className="py-3.5 px-4 text-right space-x-2">
															<button
																onClick={() => refreshSingleStatus(item.id)}
																disabled={refreshingOrderId === item.id}
																className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
																title="Refresh live status">
																<svg className={`w-4 h-4 ${refreshingOrderId === item.id ? "animate-spin text-blue-600" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
																</svg>
															</button>
															<button
																onClick={() => setRawModalData({
																	orderNumber: item.order_number,
																	provider: item.courier_provider,
																	data: item.courier_data,
																})}
																className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
																title="View raw API JSON data">
																JSON Data
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					)}

					{/* ================= Create Pathao Delivery Form Tab ================= */}
					{activeTab === "create_delivery" && (
						<form onSubmit={submitDirectOrder} className="space-y-6">
							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Left 2 Columns: Main Form Fields */}
								<div className="lg:col-span-2 space-y-6">
									{/* Basic Information */}
									<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
										<h2 className="text-base font-semibold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
											Basic Information
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Store <span className="text-red-500">*</span>
												</label>
												<select
													value={createStoreId || ""}
													onChange={(e) => setCreateStoreId(parseInt(e.target.value) || null)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													{pathaoStores.map((s) => (
														<option key={s.store_id} value={s.store_id}>
															{s.store_name?.toLowerCase().includes("gizmo") ? "⭐ " : ""}{s.store_name}
														</option>
													))}
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Product Type <span className="text-red-500">*</span>
												</label>
												<select
													value={createItemType}
													onChange={(e) => setCreateItemType(parseInt(e.target.value))}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													<option value={2}>Parcel</option>
													<option value={1}>Document</option>
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Merchant Order ID <span className="text-zinc-400 font-normal">(Optional)</span>
												</label>
												<input
													type="text"
													placeholder="Type ID (Optional)"
													value={createMerchantOrderId}
													onChange={(e) => setCreateMerchantOrderId(e.target.value)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
												/>
											</div>
										</div>
									</div>

									{/* Recipient Details */}
									<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
										<h2 className="text-base font-semibold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
											Recipient Details
										</h2>

										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<div className="flex items-center justify-between mb-1.5">
													<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
														Recipient's Phone <span className="text-red-500">*</span>
													</label>
													{createRecipientPhone.trim().length >= 11 && (
														<button
															type="button"
															onClick={() => checkCourierPhoneFraud()}
															disabled={courierFormFraudLoading}
															className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
															{courierFormFraudLoading ? "Checking..." : "🛡️ Check Risk"}
														</button>
													)}
												</div>
												<input
													type="text"
													maxLength={11}
													placeholder="017XXXXXXXX"
													value={createRecipientPhone}
													onBlur={() => {
														if (createRecipientPhone.trim().length >= 11) checkCourierPhoneFraud();
													}}
													onChange={(e) => {
														setCreateRecipientPhone(e.target.value);
														if (courierFormFraudResult) setCourierFormFraudResult(null);
													}}
													required
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 font-mono"
												/>
												{courierFormFraudResult && (
													(() => {
														const cfg = getRiskLevelConfig(courierFormFraudResult.risk_level);
														return (
															<div className={`mt-2 p-2.5 rounded-lg border ${cfg.border} ${cfg.bg} text-xs space-y-1`}>
																<div className="flex items-center justify-between">
																	<span className={`font-bold inline-flex items-center gap-1 ${cfg.color}`}>
																		<span>{cfg.icon}</span> {courierFormFraudResult.risk_level}
																	</span>
																	<span className="font-extrabold text-zinc-800 dark:text-zinc-200">
																		{courierFormFraudResult.delivery_rate}% Delivery Rate
																	</span>
																</div>
																<p className="text-[11px] text-zinc-600 dark:text-zinc-400">
																	{courierFormFraudResult.risk_message_bn}
																</p>
															</div>
														);
													})()
												)}
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Recipient's Secondary Phone <span className="text-zinc-400 font-normal">(Optional)</span>
												</label>
												<input
													type="text"
													maxLength={11}
													placeholder="015XXXXXXXX"
													value={createRecipientSecondaryPhone}
													onChange={(e) => setCreateRecipientSecondaryPhone(e.target.value)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
												/>
											</div>
										</div>

										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
												Recipient's Name <span className="text-red-500">*</span>
											</label>
											<input
												type="text"
												placeholder="Type Name"
												value={createRecipientName}
												onChange={(e) => setCreateRecipientName(e.target.value)}
												required
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
											/>
										</div>

										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
												Recipient's Address <span className="text-red-500">*</span>
											</label>
											<textarea
												rows={2}
												placeholder="Enter full address (House, Road, Sector, Area)"
												value={createRecipientAddress}
												onChange={(e) => setCreateRecipientAddress(e.target.value)}
												required
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
											/>
										</div>

										{/* Location Cascade Selectors */}
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													City
												</label>
												<select
													value={selectedCityId || ""}
													onChange={(e) => setSelectedCityId(parseInt(e.target.value) || null)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													<option value="">Select City</option>
													{cities.map((c) => (
														<option key={c.id} value={c.id}>
															{c.name}
														</option>
													))}
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Zone
												</label>
												<select
													value={selectedZoneId || ""}
													disabled={!selectedCityId || zones.length === 0}
													onChange={(e) => setSelectedZoneId(parseInt(e.target.value) || null)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50">
													<option value="">Select Zone</option>
													{zones.map((z) => (
														<option key={z.id} value={z.id}>
															{z.name}
														</option>
													))}
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Area
												</label>
												<select
													value={selectedAreaId || ""}
													disabled={!selectedZoneId || areas.length === 0}
													onChange={(e) => setSelectedAreaId(parseInt(e.target.value) || null)}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50">
													<option value="">Select Area</option>
													{areas.map((a) => (
														<option key={a.id} value={a.id}>
															{a.name}
														</option>
													))}
												</select>
											</div>
										</div>
									</div>

									{/* Delivery Details */}
									<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
										<h2 className="text-base font-semibold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3">
											Delivery Details
										</h2>

										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Delivery Type <span className="text-red-500">*</span>
												</label>
												<select
													value={createDeliveryType}
													onChange={(e) => setCreateDeliveryType(parseInt(e.target.value))}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													<option value={48}>Normal Delivery (48 Hours)</option>
													<option value={12}>On Demand Delivery (12 Hours)</option>
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Total Weight (KG) <span className="text-red-500">*</span>
												</label>
												<select
													value={createWeight}
													onChange={(e) => setCreateWeight(parseFloat(e.target.value))}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													<option value={0.5}>0.2 - 0.5 kg</option>
													<option value={1}>1 kg</option>
													<option value={1.5}>1.5 kg</option>
													<option value={2}>2 kg</option>
													<option value={3}>3 kg</option>
													<option value={5}>5 kg</option>
													<option value={10}>10 kg</option>
												</select>
											</div>

											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
													Quantity <span className="text-red-500">*</span>
												</label>
												<div className="flex items-center">
													<button
														type="button"
														onClick={() => setCreateQuantity(Math.max(1, createQuantity - 1))}
														className="px-3 py-2 border border-r-0 border-zinc-300 dark:border-zinc-700 rounded-l-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">
														-
													</button>
													<input
														type="number"
														min={1}
														value={createQuantity}
														onChange={(e) => setCreateQuantity(parseInt(e.target.value) || 1)}
														className="w-full text-center py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
													/>
													<button
														type="button"
														onClick={() => setCreateQuantity(createQuantity + 1)}
														className="px-3 py-2 border border-l-0 border-zinc-300 dark:border-zinc-700 rounded-r-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">
														+
													</button>
												</div>
											</div>
										</div>

										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
												Amount to Collect (COD in ৳) <span className="text-red-500">*</span>
											</label>
											<input
												type="number"
												min={0}
												placeholder="Enter 0 for prepaid orders or collectible COD amount"
												value={createAmountToCollect}
												onChange={(e) => {
													const val = e.target.value;
													setCreateAmountToCollect(val === "" ? 0 : Number(val));
												}}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 font-semibold"
											/>
										</div>

										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
												Item Description & Price <span className="text-zinc-400 font-normal">(Optional)</span>
											</label>
											<textarea
												rows={2}
												placeholder="Type items' names & their prices"
												value={createItemDescription}
												onChange={(e) => setCreateItemDescription(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
											/>
										</div>

										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
												Special Instructions <span className="text-zinc-400 font-normal">(Optional)</span>
											</label>
											<textarea
												rows={2}
												placeholder="e.g. Handle with care, deliver before 5 PM"
												value={createSpecialInstruction}
												onChange={(e) => setCreateSpecialInstruction(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
											/>
										</div>
									</div>

									{/* Action Buttons */}
									<div className="flex items-center gap-4 justify-end">
										<button
											type="button"
											onClick={() => setActiveTab("deliveries")}
											className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
											Cancel
										</button>
										<button
											type="submit"
											disabled={submittingOrder}
											className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">
											{submittingOrder ? (
												<>
													<svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
													Dispatching Delivery...
												</>
											) : (
												"Save & Create Delivery"
											)}
										</button>
									</div>
								</div>

								{/* Right Column: Live Price & Rate Card */}
								<div className="space-y-6">
									{/* Live Cost Summary Card */}
									<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm sticky top-6">
										<h3 className="text-base font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
											Cost Of Delivery
											{calculatingPrice && (
												<span className="text-xs text-blue-600 flex items-center gap-1 font-normal">
													<svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
													</svg>
													Calculating...
												</span>
											)}
										</h3>

										<div className="space-y-3 text-sm">
											<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
												<span>Delivery Fee</span>
												<span className="font-semibold text-zinc-900 dark:text-white">
													৳{calculatedPrice ? calculatedPrice.price : 60}
												</span>
											</div>

											<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
												<span>COD Fee</span>
												<span className="font-semibold text-zinc-900 dark:text-white">
													৳{calculatedPrice ? calculatedPrice.codFee : 0}
												</span>
											</div>

											<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
												<span>Discount</span>
												<span className="font-semibold text-emerald-600">-৳0</span>
											</div>

											<div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
												<span>Promo Discount</span>
												<span className="font-semibold text-emerald-600">-৳0</span>
											</div>

											<div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex items-center justify-between text-base font-bold text-zinc-900 dark:text-white">
												<span>Total Cost</span>
												<span className="text-red-600 dark:text-red-400 text-lg">
													৳{calculatedPrice ? calculatedPrice.finalPrice : 60}
												</span>
											</div>
										</div>

										<div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
											<p className="font-semibold text-zinc-900 dark:text-white">Pick-up Timings & Policy:</p>
											<p>• Normal Delivery Pick-up Entry Last Time: <strong>4.00 PM</strong></p>
											<p>• Same-Day / Express Entry Last Time: <strong>12.00 PM</strong></p>
											<p>• SLA inside Dhaka: 24-48 hours. Outside Dhaka: 3-5 days.</p>
										</div>
									</div>
								</div>
							</div>
						</form>
					)}

					{/* ================= Pathao Settings Tab ================= */}
					{activeTab === "pathao" && (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
									Pathao Configuration
									<span
										className={`w-2.5 h-2.5 rounded-full ${pathaoConnected ? "bg-emerald-500" : "bg-red-500"}`}></span>
								</h2>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Environment
								</label>
								<div className="flex items-center gap-4">
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="radio"
											name="pathao_env"
											value="sandbox"
											checked={
												settings.pathao_environment ===
												"sandbox"
											}
											onChange={() =>
												setSettings({
													...settings,
													pathao_environment:
														"sandbox",
												})
											}
											className="w-4 h-4 text-blue-600 border-zinc-300 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700"
										/>
										<span className="text-sm text-zinc-900 dark:text-zinc-300">
											Sandbox
										</span>
									</label>
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="radio"
											name="pathao_env"
											value="production"
											checked={
												settings.pathao_environment ===
												"production"
											}
											onChange={() =>
												setSettings({
													...settings,
													pathao_environment:
														"production",
												})
											}
											className="w-4 h-4 text-blue-600 border-zinc-300 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700"
										/>
										<span className="text-sm text-zinc-900 dark:text-zinc-300">
											Production
										</span>
									</label>
									{settings.pathao_environment ===
										"production" && (
										<span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full dark:bg-red-900/30 dark:text-red-400">
											Live Environment
										</span>
									)}
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Client ID
									</label>
									<input
										type="text"
										value={settings.pathao_client_id}
										onChange={(e) =>
											setSettings({
												...settings,
												pathao_client_id:
													e.target.value,
											})
										}
										placeholder="Enter Pathao Client ID"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Client Secret
									</label>
									<input
										type="password"
										value={
											settings.pathao_client_secret
										}
										onChange={(e) =>
											setSettings({
												...settings,
												pathao_client_secret:
													e.target.value,
											})
										}
										placeholder="Enter Pathao Client Secret"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Username (Email)
									</label>
									<input
										type="email"
										value={settings.pathao_username}
										onChange={(e) =>
											setSettings({
												...settings,
												pathao_username:
													e.target.value,
											})
										}
										placeholder="Enter Pathao login email"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Password
									</label>
									<input
										type="password"
										value={settings.pathao_password}
										onChange={(e) =>
											setSettings({
												...settings,
												pathao_password:
													e.target.value,
											})
										}
										placeholder="Enter Pathao login password"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
							</div>

							<div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700">
								<button
									onClick={testPathaoConnection}
									disabled={
										testingPathao ||
										!settings.pathao_client_id
									}
									className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2">
									{testingPathao ? (
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
											Testing Connection...
										</>
									) : (
										"Test Pathao Connection"
									)}
								</button>
							</div>

							{pathaoStores.length > 0 && (
								<div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
									<div className="flex items-center justify-between">
										<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
											Default Store ({pathaoStores.length} stores found)
										</label>
									</div>
									<input
										type="text"
										placeholder="Filter stores by name..."
										value={storeSearchFilter}
										onChange={(e) => setStoreSearchFilter(e.target.value)}
										className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
									<select
										value={
											settings.pathao_default_store_id ||
											""
										}
										onChange={(e) =>
											setSettings({
												...settings,
												pathao_default_store_id:
													parseInt(
														e.target.value,
													) || null,
											})
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm">
										<option value="">
											Select a store
										</option>
										{pathaoStores
											.filter((store) =>
												!storeSearchFilter ||
												store.store_name
													.toLowerCase()
													.includes(storeSearchFilter.toLowerCase()),
											)
											.map((store) => (
												<option
													key={store.store_id}
													value={store.store_id}>
													{store.store_name?.toLowerCase().includes("gizmo") ? "⭐ " : ""}{store.store_name} (ID: {store.store_id})
												</option>
											))}
									</select>
								</div>
							)}
						</div>
					)}

					{/* ================= Steadfast Tab ================= */}
					{activeTab === "steadfast" && (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
									Steadfast Configuration
									<span
										className={`w-2.5 h-2.5 rounded-full ${steadfastConnected ? "bg-emerald-500" : "bg-red-500"}`}></span>
								</h2>
							</div>

							<div className="grid grid-cols-1 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										API Key
									</label>
									<input
										type="text"
										value={settings.steadfast_api_key}
										onChange={(e) =>
											setSettings({
												...settings,
												steadfast_api_key:
													e.target.value,
											})
										}
										placeholder="Enter Steadfast API Key"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Secret Key
									</label>
									<input
										type="password"
										value={
											settings.steadfast_secret_key
										}
										onChange={(e) =>
											setSettings({
												...settings,
												steadfast_secret_key:
													e.target.value,
											})
										}
										placeholder="Enter Steadfast Secret Key"
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
									/>
								</div>
							</div>

							<div className="pt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700">
								<button
									onClick={testSteadfastConnection}
									disabled={
										testingSteadfast ||
										!settings.steadfast_api_key
									}
									className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2">
									{testingSteadfast ? (
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
											Testing Connection...
										</>
									) : (
										"Test Steadfast Connection & Check Balance"
									)}
								</button>
							</div>
						</div>
					)}

					{/* ================= Phone Fraud Check Tab ================= */}
					{activeTab === "fraud_check" && (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
										<span>🛡️</span> Customer Phone Fraud & Return History Check
									</h2>
									<p className="text-xs text-zinc-500 mt-0.5">
										Check customer delivery success rate across SteadFast, Pathao, RedX & Paperfly before dispatching parcels
									</p>
								</div>
								<Link
									href="/admin/fraud-check"
									className="text-xs font-semibold text-blue-600 hover:underline">
									Open Full Fraud Tool →
								</Link>
							</div>

							<div className="flex gap-3">
								<input
									type="tel"
									value={tabFraudPhone}
									onChange={(e) => setTabFraudPhone(e.target.value)}
									placeholder="Enter 11-digit BD mobile number (e.g. 01712345678)"
									className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white font-mono"
								/>
								<button
									type="button"
									onClick={() => runTabFraudCheck()}
									disabled={tabFraudLoading}
									className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
									{tabFraudLoading ? "Checking..." : "Check History"}
								</button>
							</div>

							{tabFraudError && (
								<div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
									⚠️ {tabFraudError}
								</div>
							)}

							{tabFraudResult && (
								(() => {
									const cfg = getRiskLevelConfig(tabFraudResult.risk_level);
									return (
										<div className="space-y-4">
											<div className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badge}`}>
															<span>{cfg.icon}</span> {tabFraudResult.risk_level}
														</span>
														<span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200">
															{tabFraudResult.phone}
														</span>
													</div>
													<p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
														{tabFraudResult.risk_message_bn}
													</p>
													<p className="text-xs text-zinc-600 dark:text-zinc-400">
														{tabFraudResult.risk_message_en}
													</p>
												</div>

												<div className="text-right shrink-0">
													<span className="text-xs text-zinc-400 block uppercase font-bold">Delivery Rate</span>
													<span className={`text-3xl font-extrabold ${cfg.color}`}>
														{tabFraudResult.delivery_rate}%
													</span>
												</div>
											</div>

											{/* Courier grid */}
											<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
												<div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
													<p className="text-[10px] text-zinc-400 uppercase font-bold">Total Orders</p>
													<p className="text-xl font-bold text-zinc-900 dark:text-white">{tabFraudResult.total_orders}</p>
												</div>
												<div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
													<p className="text-[10px] text-emerald-600 uppercase font-bold">Delivered</p>
													<p className="text-xl font-bold text-emerald-600">{tabFraudResult.total_delivered}</p>
												</div>
												<div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200/60 dark:border-red-800/60">
													<p className="text-[10px] text-red-600 uppercase font-bold">Cancelled</p>
													<p className="text-xl font-bold text-red-600">{tabFraudResult.total_cancelled}</p>
												</div>
												<div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
													<p className="text-[10px] text-zinc-400 uppercase font-bold">Recommendation</p>
													<p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1">{cfg.actionLabel}</p>
												</div>
											</div>

											{tabFraudResult.couriers && tabFraudResult.couriers.length > 0 && (
												<div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
													<h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
														Courier Breakdown
													</h4>
													<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
														{tabFraudResult.couriers.map((c) => (
															<div key={c.name} className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
																<span className="font-semibold text-zinc-800 dark:text-zinc-200">{c.name}</span>
																<div className="flex items-center gap-2">
																	<span className="text-zinc-400 text-[11px]">{c.delivered}/{c.orders} delivered</span>
																	<span className="font-bold text-zinc-900 dark:text-white">{c.orders > 0 ? `${c.rate}%` : "-"}</span>
																</div>
															</div>
														))}
													</div>
												</div>
											)}
										</div>
									);
								})()
							)}
						</div>
					)}

					{/* General Global Settings (always shown at bottom of settings tabs) */}
					{activeTab !== "deliveries" && activeTab !== "create_delivery" && activeTab !== "fraud_check" && (
						<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
								Default Settings
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Default Courier Provider
									</label>
									<select
										value={settings.default_provider}
										onChange={(e) =>
											setSettings({
												...settings,
												default_provider: e.target
													.value as
													| "none"
													| "pathao"
													| "steadfast",
											})
										}
										className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										<option value="none">None</option>
										<option value="pathao">Pathao</option>
										<option value="steadfast">
											Steadfast
										</option>
									</select>
								</div>
							</div>

							<div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
								<div>
									<p className="font-medium text-zinc-900 dark:text-white">
										Enable Courier Integration
									</p>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Allow sending orders directly to courier
										services
									</p>
								</div>
								<label className="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={settings.is_active}
										onChange={(e) =>
											setSettings({
												...settings,
												is_active: e.target.checked,
											})
										}
										className="sr-only peer"
									/>
									<div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
								</label>
							</div>

							<div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
								<button
									onClick={handleSave}
									disabled={saving}
									className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
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
											Save Courier Settings
										</>
									)}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ================= RAW JSON MODAL ================= */}
			{rawModalData && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
						<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h3 className="text-lg font-bold text-zinc-900 dark:text-white">
								Raw API Data — Order {rawModalData.orderNumber} ({rawModalData.provider.toUpperCase()})
							</h3>
							<button
								onClick={() => setRawModalData(null)}
								className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						<div className="flex-1 overflow-auto bg-zinc-950 text-emerald-400 p-4 rounded-lg font-mono text-xs leading-relaxed">
							<pre>{JSON.stringify(rawModalData.data, null, 2)}</pre>
						</div>
						<div className="flex justify-end pt-2">
							<button
								onClick={() => setRawModalData(null)}
								className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg text-sm font-medium">
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
