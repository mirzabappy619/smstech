import { NextRequest, NextResponse } from "next/server";
import { checkPhoneNumberFraud } from "@/lib/fraud-check";
import { isValidBDPhone, normalizeBDPhone } from "@/lib/bd-phone-validator";

function extractApiKey(request: NextRequest, bodyApiKey?: string): string {
	const headerKey = request.headers.get("x-api-key");
	if (headerKey) return headerKey.trim();

	const authHeader = request.headers.get("authorization");
	if (authHeader?.toLowerCase().startsWith("bearer ")) {
		return authHeader.slice(7).trim();
	}

	const { searchParams } = new URL(request.url);
	const queryKey = searchParams.get("api_key");
	if (queryKey) return queryKey.trim();

	if (bodyApiKey) return bodyApiKey.trim();

	return process.env.FRAUD_CHECK_API_KEY || "12oclock_demo_key";
}

/**
 * GET /api/v1/fraud-check?phone=01712345678&api_key=12oclock_demo_key
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const phone = searchParams.get("phone");

		if (!phone) {
			return NextResponse.json(
				{
					success: false,
					error: "Phone number is required. Pass via ?phone= parameter.",
				},
				{ status: 400 },
			);
		}

		const normalized = normalizeBDPhone(phone);
		if (!isValidBDPhone(normalized)) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid Bangladeshi phone number. Must be a valid 11-digit number starting with 01 (e.g. 01712345678 or +8801712345678).",
				},
				{ status: 400 },
			);
		}

		const apiKey = extractApiKey(request);
		const result = await checkPhoneNumberFraud(normalized, { apiKey });

		if (!result.success && result.error?.toLowerCase().includes("unauthorized")) {
			return NextResponse.json(
				{
					success: false,
					error: "Unauthorized. Valid API key required. Pass via X-API-Key header or ?api_key= query parameter.",
				},
				{ status: 401 },
			);
		}

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error("Fraud check API GET error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error occurred while performing fraud check.",
			},
			{ status: 500 },
		);
	}
}

/**
 * POST /api/v1/fraud-check
 * Body: { phone: "01712345678", api_key?: "12oclock_demo_key" }
 */
export async function POST(request: NextRequest) {
	try {
		let body: any = {};
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{ success: false, error: "Invalid JSON request body." },
				{ status: 400 },
			);
		}

		const phone = body.phone || body.phone_number;
		if (!phone) {
			return NextResponse.json(
				{
					success: false,
					error: "Phone number is required in JSON body { phone: '01712345678' }.",
				},
				{ status: 400 },
			);
		}

		const normalized = normalizeBDPhone(String(phone));
		if (!isValidBDPhone(normalized)) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid Bangladeshi phone number. Must be a valid 11-digit number starting with 01 (e.g. 01712345678 or +8801712345678).",
				},
				{ status: 400 },
			);
		}

		const apiKey = extractApiKey(request, body.api_key);
		const result = await checkPhoneNumberFraud(normalized, { apiKey });

		if (!result.success && result.error?.toLowerCase().includes("unauthorized")) {
			return NextResponse.json(
				{
					success: false,
					error: "Unauthorized. Valid API key required. Pass via X-API-Key header or api_key body field.",
				},
				{ status: 401 },
			);
		}

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error("Fraud check API POST error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Internal server error occurred while performing fraud check.",
			},
			{ status: 500 },
		);
	}
}
