"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginFormContent() {
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirectTo") || "/";
	const errorParam = searchParams.get("error");

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// Show error messages from URL params
	useEffect(() => {
		if (errorParam === "forbidden") {
			setError("Access denied. Admin privileges required.");
		} else if (errorParam === "account_setup_required") {
			setError(
				"Your account needs to be set up. Please contact an administrator.",
			);
		}
	}, [errorParam]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			// Sign in with browser Supabase client to store session cookies in browser
			const supabase = createBrowserSupabaseClient();
			const { error: authError } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (authError) {
				throw new Error(authError.message || "Invalid login credentials");
			}

			// Validate with backend API for status & role resolution
			const response = await fetch("/api/v1/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error?.message || "Login failed");
			}

			// Intelligently redirect admin/owner users to /admin if no specific destination was requested
			const userRole = data.data?.user?.role || data.user?.role;
			let destination = redirectTo;
			if ((!redirectTo || redirectTo === "/") && (userRole === "admin" || userRole === "owner")) {
				destination = "/admin";
			}

			// Full page transition to ensure all auth session cookies are loaded cleanly
			window.location.href = destination;
		} catch (err: any) {
			setError(err.message || "An error occurred during login");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-md w-full space-y-8">
			<div>
				<Link
					href="/"
					className="flex justify-center">
					<div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-2xl">E</span>
					</div>
				</Link>
				<h2 className="mt-6 text-center text-3xl font-bold text-zinc-900 dark:text-white">
					Sign in to your account
				</h2>
				<p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
					Or{" "}
					<Link
						href="/register"
						className="font-medium text-blue-600 hover:text-blue-500">
						create a new account
					</Link>
				</p>
			</div>

			<form
				className="mt-8 space-y-6"
				onSubmit={handleSubmit}>
				{error && (
					<div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
						<p className="text-sm text-red-800 dark:text-red-400">{error}</p>
					</div>
				)}

				<div className="rounded-md shadow-sm -space-y-px">
					<div>
						<label
							htmlFor="email"
							className="sr-only">
							Email address
						</label>
						<input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="appearance-none rounded-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
							placeholder="Email address"
						/>
					</div>
					<div>
						<label
							htmlFor="password"
							className="sr-only">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="appearance-none rounded-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
							placeholder="Password"
						/>
					</div>
				</div>

				<div className="flex items-center justify-between">
					<div className="flex items-center">
						<input
							id="remember-me"
							name="remember-me"
							type="checkbox"
							className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
						/>
						<label
							htmlFor="remember-me"
							className="ml-2 block text-sm text-zinc-900 dark:text-zinc-400">
							Remember me
						</label>
					</div>

					<div className="text-sm">
						<Link
							href="/forgot-password"
							className="font-medium text-blue-600 hover:text-blue-500">
							Forgot your password?
						</Link>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</div>
			</form>
		</div>
	);
}
