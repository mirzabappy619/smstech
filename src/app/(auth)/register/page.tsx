"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";

export default function RegisterPage() {
	const router = useRouter();
	const [formData, setFormData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		confirmPassword: "",
		phone: "",
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [acceptTerms, setAcceptTerms] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		// Validation
		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		if (formData.password.length < 8) {
			setError("Password must be at least 8 characters long");
			setLoading(false);
			return;
		}

		if (formData.phone && !isValidBDPhone(formData.phone)) {
			setError(BD_PHONE_ERROR_MESSAGE);
			setLoading(false);
			return;
		}

		if (!acceptTerms) {
			setError("You must accept the terms and conditions");
			setLoading(false);
			return;
		}

		try {
			const response = await fetch("/api/v1/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: formData.firstName,
					lastName: formData.lastName,
					email: formData.email,
					password: formData.password,
					phone: formData.phone,
				}),
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.error?.message || "Registration failed");
			}

			// Redirect to login or home
			router.push("/login?registered=true");
		} catch (err: any) {
			setError(err.message || "An error occurred during registration");
		} finally {
			setLoading(false);
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData((prev) => ({
			...prev,
			[e.target.name]: e.target.value,
		}));
	};

	return (
		<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
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
						Create your account
					</h2>
					<p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
						Already have an account?{" "}
						<Link
							href="/login"
							className="font-medium text-blue-600 hover:text-blue-500">
							Sign in
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

					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label
									htmlFor="firstName"
									className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									First Name
								</label>
								<input
									id="firstName"
									name="firstName"
									type="text"
									required
									value={formData.firstName}
									onChange={handleChange}
									className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									placeholder="John"
								/>
							</div>
							<div>
								<label
									htmlFor="lastName"
									className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
									Last Name
								</label>
								<input
									id="lastName"
									name="lastName"
									type="text"
									required
									value={formData.lastName}
									onChange={handleChange}
									className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
									placeholder="Doe"
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Email Address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								value={formData.email}
								onChange={handleChange}
								className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								placeholder="john@example.com"
							/>
						</div>

						<div>
							<label
								htmlFor="phone"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Phone Number (Optional)
							</label>
							<input
								id="phone"
								name="phone"
								type="tel"
								value={formData.phone}
								onChange={handleChange}
								className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								placeholder="017XXXXXXXX"
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								value={formData.password}
								onChange={handleChange}
								className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								placeholder="••••••••"
							/>
							<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
								Must be at least 8 characters long
							</p>
						</div>

						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Confirm Password
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
								value={formData.confirmPassword}
								onChange={handleChange}
								className="appearance-none relative block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 placeholder-zinc-500 dark:placeholder-zinc-400 text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
								placeholder="••••••••"
							/>
						</div>
					</div>

					<div className="flex items-start">
						<input
							id="accept-terms"
							type="checkbox"
							checked={acceptTerms}
							onChange={(e) => setAcceptTerms(e.target.checked)}
							className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded mt-1"
						/>
						<label
							htmlFor="accept-terms"
							className="ml-2 block text-sm text-zinc-900 dark:text-zinc-400">
							I agree to the{" "}
							<Link
								href="/terms"
								className="text-blue-600 hover:text-blue-500">
								Terms and Conditions
							</Link>{" "}
							and{" "}
							<Link
								href="/privacy"
								className="text-blue-600 hover:text-blue-500">
								Privacy Policy
							</Link>
						</label>
					</div>

					<div>
						<button
							type="submit"
							disabled={loading}
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
							{loading ? "Creating account..." : "Create Account"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
