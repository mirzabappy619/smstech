import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";

export type RiskLevel = "High Risk" | "Medium Risk" | "Good" | "Excellent" | "Unknown";

export interface CourierStats {
	name: string;
	orders: number;
	delivered: number;
	cancelled: number;
	rate: number;
}

export interface FraudCheckResult {
	success: boolean;
	phone: string;
	total_orders: number;
	total_delivered: number;
	total_cancelled: number;
	delivery_rate: number;
	risk_level: RiskLevel;
	risk_message_bn: string;
	risk_message_en: string;
	couriers: CourierStats[];
	timestamp: string;
	error?: string;
}

export interface FraudCheckOptions {
	apiKey?: string;
	baseUrl?: string;
	timeoutMs?: number;
}

const DEFAULT_API_KEY = process.env.FRAUD_CHECK_API_KEY || "12oclock_demo_key";
const DEFAULT_BASE_URL = process.env.FRAUD_CHECK_BASE_URL || "https://12oclock.org";
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Checks customer delivery history and risk level using the 12oClock Fraud Check API.
 *
 * @param phone Raw phone number string (e.g. 01712345678, +8801712345678)
 * @param options Optional custom API key, base URL, or timeout
 */
export async function checkPhoneNumberFraud(
	phone: string,
	options: FraudCheckOptions = {},
): Promise<FraudCheckResult> {
	const normalizedPhone = normalizeBDPhone(phone);

	if (!normalizedPhone || !isValidBDPhone(normalizedPhone)) {
		return {
			success: false,
			phone: phone || "",
			total_orders: 0,
			total_delivered: 0,
			total_cancelled: 0,
			delivery_rate: 0,
			risk_level: "Unknown",
			risk_message_bn: "অবৈধ মোবাইল নম্বর। সঠিক ১১ ডিজিটের নম্বর দিন।",
			risk_message_en: BD_PHONE_ERROR_MESSAGE,
			couriers: [],
			timestamp: new Date().toISOString(),
			error: BD_PHONE_ERROR_MESSAGE,
		};
	}

	const apiKey = options.apiKey || DEFAULT_API_KEY;
	const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
	const endpoint = `${baseUrl}/api/v1/fraud-check?phone=${encodeURIComponent(normalizedPhone)}&api_key=${encodeURIComponent(apiKey)}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

	try {
		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"X-API-Key": apiKey,
			},
			signal: controller.signal,
			cache: "no-store",
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMsg = errorData.error || `Fraud check API returned status ${response.status}`;
			return {
				success: false,
				phone: normalizedPhone,
				total_orders: 0,
				total_delivered: 0,
				total_cancelled: 0,
				delivery_rate: 0,
				risk_level: "Unknown",
				risk_message_bn: "ফ্রড চেক সিস্টেমে সমস্যা হয়েছে।",
				risk_message_en: errorMsg,
				couriers: [],
				timestamp: new Date().toISOString(),
				error: errorMsg,
			};
		}

		const data = await response.json();

		if (!data || !data.success) {
			return {
				success: false,
				phone: normalizedPhone,
				total_orders: 0,
				total_delivered: 0,
				total_cancelled: 0,
				delivery_rate: 0,
				risk_level: "Unknown",
				risk_message_bn: data.risk_message_bn || "কোন তথ্য পাওয়া যায়নি।",
				risk_message_en: data.error || data.risk_message_en || "No history found for this phone number.",
				couriers: [],
				timestamp: new Date().toISOString(),
				error: data.error,
			};
		}

		// Normalize risk level string
		let riskLevel: RiskLevel = "Unknown";
		const rawLevel = String(data.risk_level || "").toLowerCase();
		if (rawLevel.includes("high")) riskLevel = "High Risk";
		else if (rawLevel.includes("medium")) riskLevel = "Medium Risk";
		else if (rawLevel.includes("good")) riskLevel = "Good";
		else if (rawLevel.includes("excellent")) riskLevel = "Excellent";

		return {
			success: true,
			phone: data.phone || normalizedPhone,
			total_orders: Number(data.total_orders ?? 0),
			total_delivered: Number(data.total_delivered ?? 0),
			total_cancelled: Number(data.total_cancelled ?? 0),
			delivery_rate: Number(data.delivery_rate ?? 0),
			risk_level: riskLevel,
			risk_message_bn: data.risk_message_bn || getDefaultBnMessage(riskLevel),
			risk_message_en: data.risk_message_en || getDefaultEnMessage(riskLevel),
			couriers: Array.isArray(data.couriers)
				? data.couriers.map((c: any) => ({
						name: String(c.name || ""),
						orders: Number(c.orders ?? 0),
						delivered: Number(c.delivered ?? 0),
						cancelled: Number(c.cancelled ?? 0),
						rate: Number(c.rate ?? 0),
				  }))
				: [],
			timestamp: data.timestamp || new Date().toISOString(),
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const message = err instanceof Error ? err.message : "Failed to connect to fraud check service";
		return {
			success: false,
			phone: normalizedPhone,
			total_orders: 0,
			total_delivered: 0,
			total_cancelled: 0,
			delivery_rate: 0,
			risk_level: "Unknown",
			risk_message_bn: "ফ্রড চেক সার্ভিসের সাথে সংযোগ করা যায়নি।",
			risk_message_en: message,
			couriers: [],
			timestamp: new Date().toISOString(),
			error: message,
		};
	}
}

function getDefaultBnMessage(riskLevel: RiskLevel): string {
	switch (riskLevel) {
		case "High Risk":
			return "এই গ্রাহককে পার্সেল ডেলিভারি করা অত্যন্ত ঝুঁকিপূর্ণ। অগ্রিম পেমেন্ট নিন।";
		case "Medium Risk":
			return "পার্সেল পাঠানোর পূর্বে গ্রাহকের সাথে ফোনে কথা বলে নিশ্চিত হোন।";
		case "Good":
			return "ডেলিভারি সাধারণত নিরাপদ তবে সাবধান থাকা ভালো।";
		case "Excellent":
			return "অত্যন্ত বিশ্বস্ত গ্রাহক। ক্যাশ অন ডেলিভারি (COD) নিশ্চিত করা নিরাপদ।";
		default:
			return "গ্রাহকের কোনো পূর্ববর্তী রেকর্ড পাওয়া যায়নি।";
	}
}

function getDefaultEnMessage(riskLevel: RiskLevel): string {
	switch (riskLevel) {
		case "High Risk":
			return "High risk of order rejection/cancellation. Require advance payment.";
		case "Medium Risk":
			return "Exercise caution before dispatching COD parcel. Confirm via phone call.";
		case "Good":
			return "Customer has reliable delivery history.";
		case "Excellent":
			return "High completion history. Safe to ship COD.";
		default:
			return "No previous delivery record found for this customer.";
	}
}

/**
 * Returns color classes and icons corresponding to risk level.
 */
export function getRiskLevelConfig(riskLevel: RiskLevel) {
	switch (riskLevel) {
		case "High Risk":
			return {
				color: "text-red-700 dark:text-red-400",
				bg: "bg-red-50 dark:bg-red-950/40",
				border: "border-red-200 dark:border-red-800",
				badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200",
				icon: "⚠️",
				actionLabel: "Require Advance Payment",
				actionLabelBn: "অগ্রিম ডেলিভারি চার্জ নিন",
				isSafeForCOD: false,
			};
		case "Medium Risk":
			return {
				color: "text-amber-700 dark:text-amber-400",
				bg: "bg-amber-50 dark:bg-amber-950/40",
				border: "border-amber-200 dark:border-amber-800",
				badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200",
				icon: "⚡",
				actionLabel: "Confirm via Phone Call",
				actionLabelBn: "ফোনে নিশ্চিত করুন",
				isSafeForCOD: false,
			};
		case "Good":
			return {
				color: "text-blue-700 dark:text-blue-400",
				bg: "bg-blue-50 dark:bg-blue-950/40",
				border: "border-blue-200 dark:border-blue-800",
				badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200",
				icon: "✓",
				actionLabel: "Safe to Process",
				actionLabelBn: "ডেলিভারি নিরাপদ",
				isSafeForCOD: true,
			};
		case "Excellent":
			return {
				color: "text-emerald-700 dark:text-emerald-400",
				bg: "bg-emerald-50 dark:bg-emerald-950/40",
				border: "border-emerald-200 dark:border-emerald-800",
				badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200",
				icon: "★",
				actionLabel: "Safe for COD",
				actionLabelBn: "নিরাপদ ক্যাশ অন ডেলিভারি",
				isSafeForCOD: true,
			};
		default:
			return {
				color: "text-slate-700 dark:text-slate-400",
				bg: "bg-slate-50 dark:bg-slate-900/40",
				border: "border-slate-200 dark:border-slate-800",
				badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
				icon: "ℹ️",
				actionLabel: "New Customer",
				actionLabelBn: "নতুন গ্রাহক",
				isSafeForCOD: true,
			};
	}
}
