import React from "react";

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
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

	// Get user role from database
	const { data: userData, error: userError } = await supabase
		.from("users")
		.select("role, first_name, last_name, email")
		.eq("auth_id", user.id)
		.single();

	// If user not found in users table, redirect to login (account setup incomplete)
	if (userError || !userData) {
		redirect("/login?redirectTo=/admin&error=account_setup_required");
	}

	// If user doesn't have admin/owner role, redirect to login with forbidden message
	if (!["admin", "owner"].includes(userData.role)) {
		redirect("/login?redirectTo=/admin&error=forbidden");
	}

	return {
		profile: userData,
	};
}

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { profile } = await AdminAuthGuard();

	const userInitials =
		profile.first_name && profile.last_name
			? `${profile.first_name[0]}${profile.last_name[0]}`
			: profile.email[0].toUpperCase();

	const userName =
		profile.first_name && profile.last_name
			? `${profile.first_name} ${profile.last_name}`
			: profile.email;

	return (
		<AdminLayoutClient
			userName={userName}
			userEmail={profile.email}
			userRole={profile.role}
			userInitials={userInitials}>
			{children}
		</AdminLayoutClient>
	);
}
