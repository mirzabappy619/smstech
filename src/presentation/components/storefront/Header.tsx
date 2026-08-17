"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "@/presentation/components/ui/theme-switcher";

interface HeaderProps {
	className?: string;
}

export default function Header({ className = "" }: HeaderProps) {
	const pathname = usePathname();

	const isActive = (path: string) => {
		if (path === "/") {
			return pathname === "/";
		}
		return pathname.startsWith(path);
	};

	return (
		<header
			className={`bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 ${className}`}>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-16">
					<Link
						href="/"
						className="text-2xl font-bold text-zinc-900 dark:text-white">
						Store
					</Link>

					<nav className="hidden md:flex items-center gap-8">
						<Link
							href="/products"
							className={`transition-colors ${
								isActive("/products")
									? "text-blue-600 dark:text-blue-400 font-medium"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							}`}>
							Products
						</Link>
						<Link
							href="/categories"
							className={`transition-colors ${
								isActive("/categories")
									? "text-blue-600 dark:text-blue-400 font-medium"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							}`}>
							Categories
						</Link>
						<Link
							href="/deals"
							className={`transition-colors ${
								isActive("/deals")
									? "text-red-600 dark:text-red-400 font-medium"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							}`}>
							Deals
						</Link>
						<Link
							href="/special-offers"
							className={`transition-colors ${
								isActive("/special-offers")
									? "text-purple-600 dark:text-purple-400 font-medium"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							}`}>
							Special Offers
						</Link>
						<Link
							href="/about"
							className={`transition-colors ${
								isActive("/about")
									? "text-blue-600 dark:text-blue-400 font-medium"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							}`}>
							About
						</Link>
					</nav>

					<div className="flex items-center gap-4">
						<ThemeSwitcher />

						{/* Mobile menu button */}
						<button
							className="md:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
							title="Open mobile menu"
							aria-label="Open mobile menu">
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
						</button>

						{/* Search button */}
						<Link
							href="/search"
							className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
						</Link>

						{/* Account */}
						<Link
							href="/account"
							className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
						</Link>

						{/* Cart */}
						<Link
							href="/cart"
							className="relative p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
								/>
							</svg>
							{/* Cart badge - you can add cart count here later */}
						</Link>
					</div>
				</div>
			</div>
		</header>
	);
}
