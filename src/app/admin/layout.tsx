import React from "react";

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getUserPermissionsAndBranches } from "@/lib/rbac/rbac-service";
import { isAdminPanelRole } from "@/lib/rbac/roles";
import { RBACProvider } from "@/lib/rbac/rbac-context";
import { AdminLayoutClient } from "./admin-layout-client";
import { getStoreName } from "@/lib/get-store-name";

export async function generateMetadata(): Promise<Metadata> {
	const storeName = await getStoreName();
	return {
		title: {
			template: `%s | ${storeName} Admin`,
			default: `${storeName} Admin`,
		},
		description: `${storeName} Admin Dashboard`,
	};
}

async function AdminAuthGuard() {
	const supabase = await createServerClient();

	// Verify token with Supabase Auth server (getUser is secure, getSession is not)
	const {
		data: { user },
		error: userAuthError,
	} = await supabase.auth.getUser();

	if (userAuthError || !user) {
		redirect("/login?redirectTo=/admin");
	}

	// Resolve full RBAC, permissions and branch context
	const userRBAC = await getUserPermissionsAndBranches(user.id);

	if (!userRBAC) {
		redirect("/login?redirectTo=/admin&error=account_setup_required");
	}

	// Check if user has staff/admin privileges (not a basic storefront customer with no permissions)
	const hasAccess =
		isAdminPanelRole(userRBAC.role) ||
		userRBAC.permissions.length > 0 ||
		userRBAC.isOwner;

	if (!hasAccess) {
		redirect("/login?redirectTo=/admin&error=forbidden");
	}

	return {
		userRBAC,
	};
}

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userRBAC } = await AdminAuthGuard();

	const userInitials = userRBAC.fullName
		? userRBAC.fullName
				.split(" ")
				.filter(Boolean)
				.map((n: string) => n[0])
				.join("")
				.slice(0, 2)
				.toUpperCase()
		: (userRBAC.email?.[0] || "A").toUpperCase();

	return (
		<RBACProvider initialRBAC={userRBAC}>
			<AdminLayoutClient
				userName={userRBAC.fullName}
				userEmail={userRBAC.email}
				userRole={userRBAC.roleName}
				userInitials={userInitials}>
				{children}
			</AdminLayoutClient>
		</RBACProvider>
	);
}
