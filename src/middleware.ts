// Next.js Middleware for Authentication and Protection
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/account", "/wishlist"];

// Routes that require admin role
const adminRoutes = ["/admin"];

// Routes that require owner role
const ownerRoutes = ["/owner"];

// API routes that require authentication
// Note: /api/v1/cart is intentionally excluded — it supports guest users via session cookies
const protectedApiRoutes = [
	"/api/v1/users/me",
	"/api/v1/notifications",
];

// API routes that require admin role
const adminApiRoutes = [
	"/api/v1/admin",
	"/api/v1/inventory",
	"/api/v1/analytics",
];

export async function middleware(request: NextRequest) {
	const response = NextResponse.next({
		request: {
			headers: request.headers,
		},
	});

	// Development bypass: Skip auth checks if BYPASS_AUTH is enabled
	const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

	if (bypassAuth) {
		console.log(
			"[DEV MODE] Auth bypass enabled - skipping authentication checks",
		);
		return response;
	}

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return request.cookies.get(name)?.value;
				},
				set(name: string, value: string, options: CookieOptions) {
					request.cookies.set({ name, value, ...options });
					response.cookies.set({ name, value, ...options });
				},
				remove(name: string, options: CookieOptions) {
					request.cookies.set({ name, value: "", ...options });
					response.cookies.set({ name, value: "", ...options });
				},
			},
		},
	);

	const pathname = request.nextUrl.pathname;

	// Skip proxy for static files and public routes
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/static") ||
		pathname.includes(".") ||
		pathname === "/api/health"
	) {
		return response;
	}

	// Verify user with Supabase Auth server (getUser is secure; getSession trusts unverified cookie data)
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Check protected page routes
	const isProtectedRoute = protectedRoutes.some((route) =>
		pathname.startsWith(route),
	);
	const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
	const isOwnerRoute = ownerRoutes.some((route) => pathname.startsWith(route));

	// Check protected API routes
	const isProtectedApiRoute = protectedApiRoutes.some((route) =>
		pathname.startsWith(route),
	);
	const isAdminApiRoute = adminApiRoutes.some((route) =>
		pathname.startsWith(route),
	);

	// Handle unauthenticated access to protected routes
	if ((isProtectedRoute || isAdminRoute || isOwnerRoute) && !user) {
		const redirectUrl = new URL("/login", request.url);
		redirectUrl.searchParams.set("redirectTo", pathname);
		return NextResponse.redirect(redirectUrl);
	}

	// Handle unauthenticated API requests
	if ((isProtectedApiRoute || isAdminApiRoute) && !user) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401 },
		);
	}

	// Check admin/owner access
	if ((isAdminRoute || isOwnerRoute || isAdminApiRoute) && user) {
		// Get user role from database
		const { data: dbUser } = await supabase
			.from("users")
			.select("role")
			.eq("auth_id", user.id)
			.single();

		const userRole = dbUser?.role || "customer";

		// Admin routes require admin or owner role
		if (isAdminRoute || isAdminApiRoute) {
			if (!["admin", "owner"].includes(userRole)) {
				if (pathname.startsWith("/api/")) {
					return NextResponse.json(
						{ success: false, error: "Forbidden" },
						{ status: 403 },
					);
				}
				return NextResponse.redirect(new URL("/", request.url));
			}
		}

		// Owner routes require owner role only
		if (isOwnerRoute) {
			if (userRole !== "owner") {
				return NextResponse.redirect(new URL("/", request.url));
			}
		}
	}

	// Add security headers
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);

	// Add CORS headers for API routes
	if (pathname.startsWith("/api/")) {
		response.headers.set(
			"Access-Control-Allow-Origin",
			process.env.NEXT_PUBLIC_APP_URL || "*",
		);
		response.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS",
		);
		response.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		);

		// Handle preflight requests
		if (request.method === "OPTIONS") {
			return new NextResponse(null, { status: 200, headers: response.headers });
		}
	}

	return response;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
		"/api/(.*)",
	],
};
