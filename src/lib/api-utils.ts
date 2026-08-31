// API Utilities - Shared helpers for API routes

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, ZodSchema } from "zod";
import { createServerClient, createAdminClient } from "./supabase/server";
import { isAdminPanelRole } from "./rbac/roles";

// ==============================================
// API RESPONSE TYPES
// ==============================================
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
	meta?: ApiMeta;
}

export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, string[]>;
}

export interface ApiMeta {
	page?: number;
	perPage?: number;
	total?: number;
	totalPages?: number;
}

// ==============================================
// HTTP STATUS CODES
// ==============================================
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
} as const;

// ==============================================
// RESPONSE HELPERS
// ==============================================
export function successResponse<T>(
	data: T,
	status: number = HTTP_STATUS.OK,
	meta?: ApiMeta,
): NextResponse<ApiResponse<T>> {
	return NextResponse.json({ success: true, data, meta }, { status });
}

// Alias for successResponse
export const jsonResponse = successResponse;

export function errorResponse(
	code: string,
	message: string,
	status: number,
	details?: Record<string, string[]>,
): NextResponse<ApiResponse> {
	return NextResponse.json(
		{ success: false, error: { code, message, details } },
		{ status },
	);
}

export function validationErrorResponse(
	error: ZodError,
): NextResponse<ApiResponse> {
	const details = error.errors.reduce(
		(acc, err) => {
			const path = err.path.join(".");
			if (!acc[path]) acc[path] = [];
			acc[path].push(err.message);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	return errorResponse(
		"VALIDATION_ERROR",
		"Invalid request data",
		HTTP_STATUS.BAD_REQUEST,
		details,
	);
}

export function notFoundResponse(resource: string): NextResponse<ApiResponse> {
	return errorResponse(
		"NOT_FOUND",
		`${resource} not found`,
		HTTP_STATUS.NOT_FOUND,
	);
}

export function unauthorizedResponse(
	message = "Unauthorized",
): NextResponse<ApiResponse> {
	return errorResponse("UNAUTHORIZED", message, HTTP_STATUS.UNAUTHORIZED);
}

export function forbiddenResponse(
	message = "Forbidden",
): NextResponse<ApiResponse> {
	return errorResponse("FORBIDDEN", message, HTTP_STATUS.FORBIDDEN);
}

export function internalErrorResponse(
	message = "Internal server error",
): NextResponse<ApiResponse> {
	return errorResponse(
		"INTERNAL_ERROR",
		message,
		HTTP_STATUS.INTERNAL_SERVER_ERROR,
	);
}

// ==============================================
// REQUEST VALIDATION
// ==============================================
export async function validateRequest<T>(
	request: NextRequest,
	schema: ZodSchema<T>,
): Promise<
	| { data: T; error?: never }
	| { data?: never; error: NextResponse<ApiResponse> }
> {
	try {
		const body = await request.json();
		const data = schema.parse(body);
		return { data };
	} catch (error) {
		if (error instanceof ZodError) {
			return { error: validationErrorResponse(error) };
		}
		if (error instanceof SyntaxError) {
			return {
				error: errorResponse(
					"INVALID_JSON",
					"Invalid JSON in request body",
					HTTP_STATUS.BAD_REQUEST,
				),
			};
		}
		return { error: internalErrorResponse() };
	}
}

export function validateQueryParams<T>(
	request: NextRequest,
	schema: ZodSchema<T>,
):
	| { data: T; error?: never }
	| { data?: never; error: NextResponse<ApiResponse> } {
	try {
		const params = Object.fromEntries(request.nextUrl.searchParams);
		const data = schema.parse(params);
		return { data };
	} catch (error) {
		if (error instanceof ZodError) {
			return { error: validationErrorResponse(error) };
		}
		return { error: internalErrorResponse() };
	}
}

// ==============================================
// AUTHENTICATION
// ==============================================
export interface AuthUser {
	id: string;
	email: string;
	role: "customer" | "admin" | "owner" | "delivery";
}

export async function getAuthUser(
	_request: NextRequest,
): Promise<AuthUser | null> {
	try {
		const supabase = await createServerClient();
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error || !user) return null;

		// Get user profile with role using admin client to prevent RLS blockage
		const adminSupabase = await createAdminClient();
		const { data: profile } = await adminSupabase
			.from("users")
			.select("role")
			.or(`auth_id.eq.${user.id},id.eq.${user.id}`)
			.maybeSingle();

		return {
			id: user.id,
			email: user.email!,
			role: (profile?.role ?? "customer") as any,
		};
	} catch {
		return null;
	}
}

export async function getOptionalAuth(
	request: NextRequest,
): Promise<AuthUser | null> {
	return await getAuthUser(request);
}

export async function requireAuth(
	request: NextRequest,
): Promise<
	| { user: AuthUser; error?: never }
	| { user?: never; error: NextResponse<ApiResponse> }
> {
	const user = await getAuthUser(request);
	if (!user) {
		return { error: unauthorizedResponse() };
	}
	return { user };
}

export async function requireAdmin(
	request: NextRequest,
): Promise<
	| { user: AuthUser; error?: never }
	| { user?: never; error: NextResponse<ApiResponse> }
> {
	const { user, error } = await requireAuth(request);
	if (error) return { error };
	if (!isAdminPanelRole(user.role)) {
		return { error: forbiddenResponse("Admin access required") };
	}
	return { user };
}

export async function requireOwner(
	request: NextRequest,
): Promise<
	| { user: AuthUser; error?: never }
	| { user?: never; error: NextResponse<ApiResponse> }
> {
	const { user, error } = await requireAuth(request);
	if (error) return { error };
	if (user.role !== "owner") {
		return { error: forbiddenResponse("Owner access required") };
	}
	return { user };
}

// ==============================================
// AUTH MIDDLEWARE
// ==============================================
export async function withAuth(
	request: NextRequest,
	handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>,
): Promise<NextResponse> {
	const { user, error } = await requireAuth(request);
	if (error) {
		return error;
	}
	return handler(request, user);
}

export async function withAdmin(
	request: NextRequest,
	handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>,
): Promise<NextResponse> {
	const { user, error } = await requireAdmin(request);
	if (error) {
		return error;
	}
	return handler(request, user);
}

export async function withOwner(
	request: NextRequest,
	handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>,
): Promise<NextResponse> {
	const { user, error } = await requireOwner(request);
	if (error) {
		return error;
	}
	return handler(request, user);
}

// ==============================================
// PAGINATION
// ==============================================
export const paginationSchema = z.object({
	page: z
		.string()
		.optional()
		.transform((v) => Math.max(1, parseInt(v ?? "1", 10))),
	perPage: z
		.string()
		.optional()
		.transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10)))),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export function getPaginationMeta(
	page: number,
	perPage: number,
	total: number,
): ApiMeta {
	return {
		page,
		perPage,
		total,
		totalPages: Math.ceil(total / perPage),
	};
}

// Paginated response helper
export function paginatedResponse<T>(
	data: T[],
	page: number,
	perPage: number,
	total: number,
	status: number = HTTP_STATUS.OK,
): NextResponse<ApiResponse<T[]>> {
	return NextResponse.json(
		{
			success: true,
			data,
			meta: getPaginationMeta(page, perPage, total),
		},
		{ status },
	);
}
// ==============================================
// RATE LIMITING (Simple in-memory implementation)
// ==============================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
	identifier: string,
	limit: number = 100,
	windowMs: number = 60000,
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();
	const record = rateLimitStore.get(identifier);

	if (!record || record.resetAt < now) {
		rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
		return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
	}

	if (record.count >= limit) {
		return { allowed: false, remaining: 0, resetAt: record.resetAt };
	}

	record.count++;
	return {
		allowed: true,
		remaining: limit - record.count,
		resetAt: record.resetAt,
	};
}

export function rateLimitMiddleware(
	request: NextRequest,
	limit = 100,
	windowMs = 60000,
): NextResponse<ApiResponse> | null {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0] ??
		request.headers.get("x-real-ip") ??
		"unknown";

	const { allowed, resetAt } = checkRateLimit(ip, limit, windowMs);

	if (!allowed) {
		const response = errorResponse(
			"RATE_LIMIT_EXCEEDED",
			"Too many requests, please try again later",
			HTTP_STATUS.TOO_MANY_REQUESTS,
		);
		response.headers.set("X-RateLimit-Limit", limit.toString());
		response.headers.set("X-RateLimit-Remaining", "0");
		response.headers.set("X-RateLimit-Reset", resetAt.toString());
		return response;
	}

	return null;
}

// ==============================================
// LOGGING
// ==============================================
export function logRequest(request: NextRequest, user?: AuthUser | null) {
	const log = {
		timestamp: new Date().toISOString(),
		method: request.method,
		url: request.url,
		userId: user?.id ?? null,
		ip:
			request.headers.get("x-forwarded-for")?.split(",")[0] ??
			request.headers.get("x-real-ip"),
		userAgent: request.headers.get("user-agent"),
	};
	console.log("[API]", JSON.stringify(log));
}

export async function logActivity(
	action: string,
	entityType: string,
	entityId: string | null,
	userId: string | null,
	_oldValues: Record<string, unknown> | null,
	_newValues: Record<string, unknown> | null,
	_request: NextRequest,
) {
	try {
		// TODO: Fix database type issue with activity_logs
		console.log("[Activity Log]", { action, entityType, entityId, userId });
	} catch (error) {
		console.error("[Activity Log Error]", error);
	}
}

// ==============================================
// ERROR HANDLING WRAPPER
// ==============================================
export function withErrorHandling<T>(
	handler: (request: NextRequest, context?: T) => Promise<NextResponse>,
) {
	return async (request: NextRequest, context?: T): Promise<NextResponse> => {
		try {
			return await handler(request, context);
		} catch (error) {
			console.error("[API Error]", error);
			if (error instanceof ZodError) {
				return validationErrorResponse(error);
			}
			return internalErrorResponse();
		}
	};
}

// ==============================================
// COMMON SCHEMAS
// ==============================================
export const idSchema = z.object({
	id: z.string().uuid(),
});

export const slugSchema = z.object({
	slug: z.string().min(1).max(200),
});
