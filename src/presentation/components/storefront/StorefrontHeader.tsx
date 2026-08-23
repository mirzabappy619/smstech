"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	Search,
	User,
	Heart,
	ShoppingBag,
	Menu,
	X,
	Zap,
	Package,
} from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Category {
	id: string;
	name: string;
	slug: string;
}

interface SuggestionProduct {
	id: string;
	name: string;
	slug: string;
	base_price: number;
	images: string[];
}

export default function StorefrontHeader({ storeName = "SMSTech BD" }: { storeName?: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const { format: formatPrice } = useCurrency();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [cartCount, setCartCount] = useState(0);
	const [categories, setCategories] = useState<Category[]>([]);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [suggestions, setSuggestions] = useState<SuggestionProduct[]>([]);
	const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
	const searchRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchCartCount();
		fetchCategories();
	}, [pathname]);

	// Re-fetch cart count whenever any component fires the 'cart-updated' event
	useEffect(() => {
		const handleCartUpdated = () => fetchCartCount();
		window.addEventListener("cart-updated", handleCartUpdated);
		return () => window.removeEventListener("cart-updated", handleCartUpdated);
	}, []);

	// Debounced search for autocomplete suggestions
	useEffect(() => {
		if (searchQuery.length < 3) {
			setSuggestions([]);
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			setIsFetchingSuggestions(true);
			try {
				const res = await fetch(
					`/api/v1/products?search=${encodeURIComponent(searchQuery)}&limit=5`,
					{ signal: controller.signal }
				);
				const data = await res.json();
				if (data.success) {
					setSuggestions(data.data || []);
				}
			} catch (e) {
				if ((e as Error).name !== "AbortError") {
					setSuggestions([]);
				}
			} finally {
				setIsFetchingSuggestions(false);
			}
		}, 300);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [searchQuery]);

	// Click-outside dismissal for search dropdown
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
				setIsSearchOpen(false);
				setSuggestions([]);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const fetchCartCount = async () => {
		try {
			const response = await fetch("/api/v1/cart");
			const data = await response.json();
			if (data.success && data.data?.items) {
				const count = data.data.items.reduce(
					(sum: number, item: { quantity: number }) => sum + item.quantity,
					0,
				);
				setCartCount(count);
			}
		} catch {
			// Cart not available
		}
	};

	const fetchCategories = async () => {
		try {
			const response = await fetch("/api/v1/categories");
			const data = await response.json();
			if (data.success) {
				setCategories(data.data || []);
			}
		} catch {
			// Categories not available
		}
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
			setSearchQuery("");
			setIsMenuOpen(false);
		}
	};

	return (
		<header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-20">
					{/* Logo */}
					<Link
						href="/"
						className="flex items-center space-x-3 group">
						<div className="relative">
							<div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center transform transition-transform group-hover:scale-105">
								<Zap
									className="w-6 h-6 text-white"
									fill="currentColor"
								/>
							</div>
						</div>
						<div className="flex flex-col">
							<span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
								{storeName}
							</span>
						</div>
					</Link>

					{/* Desktop Navigation */}
					<nav className="hidden lg:flex items-center space-x-1">
						<Link
							href="/products"
							className={`px-4 py-2 text-sm transition-colors rounded-lg ${
								pathname === "/products"
									? "text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20"
									: "text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400"
							}`}>
							All Products
						</Link>
						{categories.slice(0, 4).map((category) => (
							<Link
								key={category.id}
								href={`/categories/${category.slug}`}
								className={`px-4 py-2 text-sm transition-colors rounded-lg ${
									pathname === `/categories/${category.slug}`
										? "text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20"
										: "text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400"
								}`}>
								{category.name}
							</Link>
						))}
						<Link
							href="/deals"
							className="px-4 py-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center space-x-1">
							<Package className="w-4 h-4" />
							<span>Deals</span>
						</Link>
					</nav>

					{/* Right Actions */}
					<div className="flex items-center space-x-2">
						{/* Search Button - Desktop */}
						<div ref={searchRef} className="hidden lg:block relative">
							{isSearchOpen ? (
								<form
									onSubmit={(e) => {
										e.preventDefault();
										if (searchQuery.trim()) {
											router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
											setSearchQuery("");
											setIsSearchOpen(false);
											setSuggestions([]);
										}
									}}
									className="relative">
									<input
										autoFocus
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => e.key === "Escape" && setIsSearchOpen(false)}
										placeholder="Search products..."
										className="w-64 pl-4 pr-10 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 text-zinc-900 dark:text-white"
									/>
									<button
										type="submit"
										className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-600">
										<Search className="w-4 h-4" />
									</button>

									{/* Suggestions Dropdown */}
									{(suggestions.length > 0 || isFetchingSuggestions) && (
										<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 overflow-hidden">
											{isFetchingSuggestions && (
												<div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
													Searching...
												</div>
											)}
											{suggestions.map((product) => (
												<Link
													key={product.id}
													href={`/products/${product.slug}`}
													onClick={() => {
														setIsSearchOpen(false);
														setSuggestions([]);
														setSearchQuery("");
													}}
													className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
													<div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 overflow-hidden flex-shrink-0">
														{product.images?.[0] ? (
															<img
																src={product.images[0]}
																alt={product.name}
																className="w-full h-full object-cover"
															/>
														) : (
															<div className="w-full h-full flex items-center justify-center text-zinc-400">
																<Package className="w-5 h-5" />
															</div>
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
															{product.name}
														</p>
														<p className="text-xs text-emerald-600 dark:text-emerald-400">
															{formatPrice(product.base_price)}
														</p>
													</div>
												</Link>
											))}
											{suggestions.length > 0 && (
												<button
													onClick={() => {
														router.push(
															`/search?q=${encodeURIComponent(searchQuery)}`
														);
														setIsSearchOpen(false);
														setSuggestions([]);
														setSearchQuery("");
													}}
													className="w-full px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 border-t border-zinc-100 dark:border-zinc-700">
													View all results for "{searchQuery}" →
												</button>
											)}
										</div>
									)}
								</form>
							) : (
								<button
									onClick={() => setIsSearchOpen(true)}
									className="flex items-center space-x-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-sm text-zinc-600 dark:text-zinc-300">
									<Search className="w-4 h-4" />
									<span>Search</span>
								</button>
							)}
						</div>

						{/* Account */}
						<Link
							href="/account"
							className="hidden sm:flex p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-700 dark:text-zinc-300">
							<User className="w-5 h-5" />
						</Link>

						{/* Wishlist */}
						<Link
							href="/wishlist"
							className="relative p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-700 dark:text-zinc-300">
							<Heart className="w-5 h-5" />
						</Link>

						{/* Cart */}
						<Link
							href="/cart"
							className="relative p-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
							<ShoppingBag className="w-5 h-5" />
							{cartCount > 0 && (
								<span className="absolute top-0 right-0 w-5 h-5 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
									{cartCount}
								</span>
							)}
						</Link>

						{/* Admin Link */}
						<Link
							href="/admin"
							className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
							Admin
						</Link>

						{/* Mobile Menu Button */}
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className="lg:hidden p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
							{isMenuOpen ? (
								<X className="w-6 h-6" />
							) : (
								<Menu className="w-6 h-6" />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Full-Screen Mobile Menu / Search Overlay */}
			{isMenuOpen && (
				<div className="fixed inset-0 top-20 bg-white dark:bg-zinc-900 z-40 overflow-y-auto animate-fade-in">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
						{/* Search Bar */}
						<form
							onSubmit={handleSearch}
							className="mb-8">
							<div className="relative">
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search products, brands, categories..."
									className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 text-zinc-900 dark:text-white"
									autoFocus
								/>
								<button
									type="submit"
									className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
									<Search className="w-5 h-5" />
								</button>
							</div>
						</form>

						{/* Categories Grid */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{categories.map((category) => (
								<Link
									key={category.id}
									href={`/categories/${category.slug}`}
									onClick={() => setIsMenuOpen(false)}
									className="p-6 bg-zinc-50 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors group">
									<div className="text-center">
										<h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 mb-1">
											{category.name}
										</h3>
									</div>
								</Link>
							))}
						</div>

						{/* Quick Links */}
						<div className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
							<div className="grid grid-cols-2 gap-4">
								<Link
									href="/deals"
									onClick={() => setIsMenuOpen(false)}
									className="px-6 py-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-center">
									<Package className="w-6 h-6 mx-auto mb-2" />
									<span className="font-medium">Special Deals</span>
								</Link>
								<Link
									href="/account"
									onClick={() => setIsMenuOpen(false)}
									className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-center">
									<User className="w-6 h-6 mx-auto mb-2" />
									<span className="font-medium">My Account</span>
								</Link>
							</div>
						</div>
					</div>
				</div>
			)}
		</header>
	);
}
