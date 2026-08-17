// Custom React Hooks for E-Commerce Application

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// ==============================================
// AUTH HOOK
// ==============================================
interface AuthState {
	user: User | null;
	profile: UserProfile | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}

interface UserProfile {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	phone?: string;
	avatarUrl?: string;
	role: "customer" | "admin" | "owner" | "delivery";
}

export function useAuth() {
	const [state, setState] = useState<AuthState>({
		user: null,
		profile: null,
		isLoading: true,
		isAuthenticated: false,
	});

	useEffect(() => {
		const supabase = createClient();

		// Get initial session
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				fetchProfile(session.user);
			} else {
				setState((s) => ({ ...s, isLoading: false }));
			}
		});

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, session) => {
			if (session?.user) {
				await fetchProfile(session.user);
			} else {
				setState({
					user: null,
					profile: null,
					isLoading: false,
					isAuthenticated: false,
				});
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	const fetchProfile = async (user: User) => {
		const supabase = createClient();

		const { data: profile } = (await supabase
			.from("users")
			.select("*")
			.eq("auth_id", user.id)
			.single()) as any;

		setState({
			user,
			profile: profile
				? {
						id: profile.id,
						email: profile.email,
						firstName: profile.first_name,
						lastName: profile.last_name,
						phone: profile.phone,
						avatarUrl: profile.avatar_url,
						role: profile.role,
					}
				: null,
			isLoading: false,
			isAuthenticated: true,
		});
	};

	const signIn = async (email: string, password: string) => {
		const supabase = createClient();
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) throw error;
		return data;
	};

	const signUp = async (
		email: string,
		password: string,
		metadata?: Record<string, unknown>,
	) => {
		const supabase = createClient();
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: metadata },
		});
		if (error) throw error;
		return data;
	};

	const signOut = async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
	};

	return {
		...state,
		signIn,
		signUp,
		signOut,
	};
}

// ==============================================
// CART HOOK
// ==============================================
interface CartItem {
	id: string;
	productId: string;
	variationId?: string;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
	product: {
		id: string;
		name: string;
		slug: string;
		images: string[];
		basePrice: number;
	};
	variation?: {
		id: string;
		name: string;
		price: number;
		attributes: Record<string, string>;
	};
}

interface Cart {
	id: string;
	items: CartItem[];
	subtotal: number;
	discountAmount: number;
	shippingAmount: number;
	taxAmount: number;
	total: number;
	coupon?: {
		id: string;
		code: string;
		type: string;
		value: number;
	};
}

interface CartState {
	cart: Cart | null;
	isLoading: boolean;
	error: string | null;
	itemCount: number;
}

export function useCart() {
	const [state, setState] = useState<CartState>({
		cart: null,
		isLoading: true,
		error: null,
		itemCount: 0,
	});

	const fetchCart = useCallback(async () => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch("/api/v1/cart");
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch cart");
			}

			const cart = data.data;
			setState({
				cart,
				isLoading: false,
				error: null,
				itemCount:
					cart?.items?.reduce(
						(sum: number, item: CartItem) => sum + item.quantity,
						0,
					) || 0,
			});
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to fetch cart",
			}));
		}
	}, []);

	useEffect(() => {
		fetchCart();
	}, [fetchCart]);

	const addItem = async (
		productId: string,
		quantity = 1,
		variationId?: string,
	) => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch("/api/v1/cart/items", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ productId, quantity, variationId }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to add item");
			}

			await fetchCart();
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to add item",
			}));
			throw error;
		}
	};

	const updateItem = async (itemId: string, quantity: number) => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch(`/api/v1/cart/items/${itemId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ quantity }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to update item");
			}

			await fetchCart();
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to update item",
			}));
			throw error;
		}
	};

	const removeItem = async (itemId: string) => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch(`/api/v1/cart/items/${itemId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to remove item");
			}

			await fetchCart();
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to remove item",
			}));
			throw error;
		}
	};

	const applyCoupon = async (code: string) => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch("/api/v1/cart/coupon", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Invalid coupon");
			}

			await fetchCart();
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Invalid coupon",
			}));
			throw error;
		}
	};

	const removeCoupon = async () => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch("/api/v1/cart/coupon", {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to remove coupon");
			}

			await fetchCart();
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error:
					error instanceof Error ? error.message : "Failed to remove coupon",
			}));
			throw error;
		}
	};

	const clearCart = async () => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch("/api/v1/cart", {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to clear cart");
			}

			setState({
				cart: null,
				isLoading: false,
				error: null,
				itemCount: 0,
			});
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to clear cart",
			}));
			throw error;
		}
	};

	return {
		...state,
		fetchCart,
		addItem,
		updateItem,
		removeItem,
		applyCoupon,
		removeCoupon,
		clearCart,
	};
}

// ==============================================
// PRODUCTS HOOK
// ==============================================
interface Product {
	id: string;
	name: string;
	slug: string;
	description: string;
	shortDescription?: string;
	sku: string;
	basePrice: number;
	compareAtPrice?: number;
	currency: string;
	images: string[];
	tags: string[];
	category?: {
		id: string;
		name: string;
		slug: string;
	};
	variations?: ProductVariation[];
	averageRating: number;
	reviewCount: number;
	isActive: boolean;
	isFeatured: boolean;
}

interface ProductVariation {
	id: string;
	name: string;
	sku: string;
	price: number;
	attributes: Record<string, string>;
	images: string[];
	isActive: boolean;
}

interface ProductFilters {
	page?: number;
	perPage?: number;
	sortBy?: "name" | "price" | "createdAt" | "updatedAt";
	sortOrder?: "asc" | "desc";
	category?: string;
	minPrice?: number;
	maxPrice?: number;
	search?: string;
	featured?: boolean;
	tags?: string[];
}

interface ProductsState {
	products: Product[];
	isLoading: boolean;
	error: string | null;
	pagination: {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
	};
}

export function useProducts(initialFilters?: ProductFilters) {
	const [state, setState] = useState<ProductsState>({
		products: [],
		isLoading: true,
		error: null,
		pagination: {
			page: 1,
			perPage: 20,
			total: 0,
			totalPages: 0,
		},
	});

	const [filters, setFilters] = useState<ProductFilters>(initialFilters || {});

	const fetchProducts = useCallback(async () => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const params = new URLSearchParams();
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					if (Array.isArray(value)) {
						params.set(key, value.join(","));
					} else {
						params.set(key, String(value));
					}
				}
			});

			const response = await fetch(`/api/v1/products?${params.toString()}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch products");
			}

			setState({
				products: data.data,
				isLoading: false,
				error: null,
				pagination: data.meta,
			});
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error:
					error instanceof Error ? error.message : "Failed to fetch products",
			}));
		}
	}, [filters]);

	useEffect(() => {
		fetchProducts();
	}, [fetchProducts]);

	const setPage = (page: number) => {
		setFilters((f) => ({ ...f, page }));
	};

	const setSearch = (search: string) => {
		setFilters((f) => ({ ...f, search, page: 1 }));
	};

	const setCategory = (category: string | undefined) => {
		setFilters((f) => ({ ...f, category, page: 1 }));
	};

	const setPriceRange = (minPrice?: number, maxPrice?: number) => {
		setFilters((f) => ({ ...f, minPrice, maxPrice, page: 1 }));
	};

	const setSort = (
		sortBy: ProductFilters["sortBy"],
		sortOrder: ProductFilters["sortOrder"],
	) => {
		setFilters((f) => ({ ...f, sortBy, sortOrder }));
	};

	return {
		...state,
		filters,
		setFilters,
		setPage,
		setSearch,
		setCategory,
		setPriceRange,
		setSort,
		refetch: fetchProducts,
	};
}

// ==============================================
// SINGLE PRODUCT HOOK
// ==============================================
export function useProduct(slug: string) {
	const [product, setProduct] = useState<Product | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchProduct = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await fetch(`/api/v1/products/${slug}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Product not found");
				}

				setProduct(data.data);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to fetch product",
				);
			} finally {
				setIsLoading(false);
			}
		};

		if (slug) {
			fetchProduct();
		}
	}, [slug]);

	return { product, isLoading, error };
}

// ==============================================
// ORDERS HOOK
// ==============================================
interface Order {
	id: string;
	orderNumber: string;
	status: string;
	paymentStatus: string;
	subtotal: number;
	discountAmount: number;
	shippingAmount: number;
	taxAmount: number;
	total: number;
	currency: string;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string;
	trackingUrl?: string;
	estimatedDelivery?: string;
	items: OrderItem[];
	createdAt: string;
}

interface OrderItem {
	id: string;
	name: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
}

interface OrdersState {
	orders: Order[];
	isLoading: boolean;
	error: string | null;
	pagination: {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
	};
}

export function useOrders() {
	const [state, setState] = useState<OrdersState>({
		orders: [],
		isLoading: true,
		error: null,
		pagination: {
			page: 1,
			perPage: 10,
			total: 0,
			totalPages: 0,
		},
	});

	const [page, setPage] = useState(1);

	const fetchOrders = useCallback(async () => {
		try {
			setState((s) => ({ ...s, isLoading: true, error: null }));

			const response = await fetch(`/api/v1/orders?page=${page}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch orders");
			}

			setState({
				orders: data.data,
				isLoading: false,
				error: null,
				pagination: data.meta,
			});
		} catch (error) {
			setState((s) => ({
				...s,
				isLoading: false,
				error:
					error instanceof Error ? error.message : "Failed to fetch orders",
			}));
		}
	}, [page]);

	useEffect(() => {
		fetchOrders();
	}, [fetchOrders]);

	return {
		...state,
		setPage,
		refetch: fetchOrders,
	};
}

// ==============================================
// WISHLIST HOOK
// ==============================================
interface WishlistItem {
	id: string;
	productId: string;
	product: Product;
	createdAt: string;
}

export function useWishlist() {
	const [items, setItems] = useState<WishlistItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchWishlist = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetch("/api/v1/users/me/wishlist");
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to fetch wishlist");
			}

			setItems(data.data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch wishlist");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchWishlist();
	}, [fetchWishlist]);

	const addItem = async (productId: string) => {
		try {
			const response = await fetch("/api/v1/users/me/wishlist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ productId }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to add to wishlist");
			}

			await fetchWishlist();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to add to wishlist",
			);
			throw err;
		}
	};

	const removeItem = async (productId: string) => {
		try {
			const response = await fetch(`/api/v1/users/me/wishlist/${productId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to remove from wishlist");
			}

			await fetchWishlist();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to remove from wishlist",
			);
			throw err;
		}
	};

	const isInWishlist = (productId: string) => {
		return items.some((item) => item.productId === productId);
	};

	return {
		items,
		isLoading,
		error,
		addItem,
		removeItem,
		isInWishlist,
		refetch: fetchWishlist,
	};
}

// ==============================================
// DEBOUNCE HOOK
// ==============================================
export function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

// ==============================================
// LOCAL STORAGE HOOK
// ==============================================
export function useLocalStorage<T>(
	key: string,
	initialValue: T,
): [T, (value: T) => void] {
	const [storedValue, setStoredValue] = useState<T>(() => {
		if (typeof window === "undefined") {
			return initialValue;
		}
		try {
			const item = window.localStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch (error) {
			console.error(error);
			return initialValue;
		}
	});

	const setValue = (value: T) => {
		try {
			setStoredValue(value);
			if (typeof window !== "undefined") {
				window.localStorage.setItem(key, JSON.stringify(value));
			}
		} catch (error) {
			console.error(error);
		}
	};

	return [storedValue, setValue];
}

// ==============================================
// INTERSECTION OBSERVER HOOK
// ==============================================
export function useIntersectionObserver(
	options: IntersectionObserverInit = {},
): [React.RefObject<HTMLElement | null>, boolean] {
	const elementRef = useRef<HTMLElement | null>(null);
	const [isIntersecting, setIsIntersecting] = useState(false);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		const observer = new IntersectionObserver(([entry]) => {
			setIsIntersecting(entry.isIntersecting);
		}, options);

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [options]);

	return [elementRef, isIntersecting];
}

// ==============================================
// TOAST NOTIFICATIONS HOOK
// ==============================================
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number;
}

export function useToast() {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = useCallback(
		(type: ToastType, message: string, duration = 5000) => {
			const id = Math.random().toString(36).substring(7);
			setToasts((prev) => [...prev, { id, type, message, duration }]);

			if (duration > 0) {
				setTimeout(() => {
					removeToast(id);
				}, duration);
			}

			return id;
		},
		[],
	);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const success = useCallback(
		(message: string, duration?: number) =>
			addToast("success", message, duration),
		[addToast],
	);

	const error = useCallback(
		(message: string, duration?: number) =>
			addToast("error", message, duration),
		[addToast],
	);

	const warning = useCallback(
		(message: string, duration?: number) =>
			addToast("warning", message, duration),
		[addToast],
	);

	const info = useCallback(
		(message: string, duration?: number) => addToast("info", message, duration),
		[addToast],
	);

	return {
		toasts,
		addToast,
		removeToast,
		success,
		error,
		warning,
		info,
	};
}
