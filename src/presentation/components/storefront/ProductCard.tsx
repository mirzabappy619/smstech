"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Heart, Star } from "lucide-react";
import { useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductCardProps {
	product: {
		id: string;
		name: string;
		slug: string;
		base_price: number;
		compare_at_price?: number | null;
		images: string[];
		average_rating?: number;
		review_count?: number;
		is_featured?: boolean;
		category?: {
			id: string;
			name: string;
			slug: string;
		} | null;
	};
}

export default function ProductCard({ product }: ProductCardProps) {
	const [addingToCart, setAddingToCart] = useState(false);
	const [addedToCart, setAddedToCart] = useState(false);
	const { format: formatPrice } = useCurrency();

	const discount =
		product.compare_at_price && product.compare_at_price > product.base_price
			? Math.round(
					((product.compare_at_price - product.base_price) /
						product.compare_at_price) *
						100,
				)
			: 0;

	const firstImage = product.images?.[0];
	const rating = product.average_rating || 0;
	const reviews = product.review_count || 0;

	const handleAddToCart = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (addingToCart) return;

		setAddingToCart(true);
		try {
			const response = await fetch("/api/v1/cart", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					product_id: product.id,
					quantity: 1,
				}),
			});
			const data = await response.json();
			if (data.success) {
				setAddedToCart(true);
				setTimeout(() => setAddedToCart(false), 2000);
				// Notify header to refresh cart count immediately
				window.dispatchEvent(new CustomEvent("cart-updated"));
			}
		} catch {
			// Failed
		} finally {
			setAddingToCart(false);
		}
	};

	return (
		<div className="group bg-white dark:bg-zinc-900 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-300">
			<Link
				href={`/products/${product.slug}`}
				className="block relative overflow-hidden bg-zinc-50 dark:bg-zinc-800">
				<div className="w-full h-72 relative">
					{firstImage ? (
						<Image
							src={firstImage}
							alt={product.name}
							fill
							className="object-cover group-hover:scale-110 transition-transform duration-500"
							sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
						/>
					) : (
						<div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600">
							<ShoppingBag className="w-16 h-16" />
						</div>
					)}
				</div>

				{/* Badges */}
				{product.is_featured && (
					<span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg bg-emerald-600">
						FEATURED
					</span>
				)}
				{discount > 0 && (
					<span className="absolute top-4 right-4 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold shadow-lg">
						-{discount}%
					</span>
				)}

				{/* Heart Button */}
				<button
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					className="absolute bottom-4 right-4 p-3 rounded-full backdrop-blur-md bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 hover:bg-rose-500 hover:text-white transition-all shadow-lg">
					<Heart className="w-5 h-5" />
				</button>
			</Link>

			<div className="p-5">
				<Link href={`/products/${product.slug}`}>
					{product.category && (
						<p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 font-medium">
							{product.category.name}
						</p>
					)}
					<h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-3 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
						{product.name}
					</h3>
				</Link>

				{/* Rating */}
				{reviews > 0 && (
					<div className="flex items-center mb-4">
						<div className="flex items-center">
							{[...Array(5)].map((_, i) => (
								<Star
									key={i}
									className={`w-4 h-4 ${
										i < Math.floor(rating)
											? "text-amber-500 fill-current"
											: "text-zinc-300 dark:text-zinc-600"
									}`}
								/>
							))}
						</div>
						<span className="text-sm text-zinc-600 dark:text-zinc-400 ml-2 font-medium">
							({reviews})
						</span>
					</div>
				)}

				{/* Price */}
				<div className="flex items-baseline space-x-2 mb-4">
					<span className="text-2xl font-bold text-zinc-900 dark:text-white">{formatPrice(product.base_price)}</span>
					{product.compare_at_price &&
						product.compare_at_price > product.base_price && (
							<span className="text-base text-zinc-400 line-through">{formatPrice(product.compare_at_price)}</span>
						)}
				</div>

				{/* Add to Cart Button */}
				<button
					onClick={handleAddToCart}
					disabled={addingToCart}
					className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center space-x-2 ${
						addedToCart
							? "bg-green-600 text-white"
							: "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg group-hover:scale-105"
					} disabled:opacity-50`}>
					<ShoppingBag className="w-5 h-5" />
					<span>
						{addingToCart
							? "Adding..."
							: addedToCart
								? "Added!"
								: "Add to Cart"}
					</span>
				</button>
			</div>
		</div>
	);
}
