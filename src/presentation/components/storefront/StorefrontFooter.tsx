import Link from "next/link";
import {
	Facebook,
	Twitter,
	Instagram,
	Mail,
	Phone,
	MapPin,
	Zap,
} from "lucide-react";
import type { StoreSettings } from "@/lib/get-store-name";

const defaultSettings: StoreSettings = {
	store_name: "SMSTech BD",
	store_email: "",
	store_phone: "",
	store_address: "",
	social_facebook: "",
	social_instagram: "",
	social_twitter: "",
};

export default function StorefrontFooter({ settings }: { settings?: StoreSettings }) {
	const s = settings ?? defaultSettings;
	const year = new Date().getFullYear();

	return (
		<footer className="bg-zinc-900 text-white">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
					{/* Company Info */}
					<div>
						<div className="flex items-center space-x-3 mb-6">
							<div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
								<Zap
									className="w-5 h-5 text-white"
									fill="currentColor"
								/>
							</div>
							<div>
								<span className="text-lg font-bold">{s.store_name}</span>
							</div>
						</div>
						<div className="flex space-x-3">
							{s.social_facebook && (
								<a
									href={s.social_facebook}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2.5 bg-zinc-800 rounded-lg hover:bg-emerald-600 transition-colors">
									<Facebook className="w-4 h-4" />
								</a>
							)}
							{s.social_twitter && (
								<a
									href={s.social_twitter}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2.5 bg-zinc-800 rounded-lg hover:bg-emerald-600 transition-colors">
									<Twitter className="w-4 h-4" />
								</a>
							)}
							{s.social_instagram && (
								<a
									href={s.social_instagram}
									target="_blank"
									rel="noopener noreferrer"
									className="p-2.5 bg-zinc-800 rounded-lg hover:bg-emerald-600 transition-colors">
									<Instagram className="w-4 h-4" />
								</a>
							)}
						</div>
					</div>

					{/* Quick Links */}
					<div>
						<h3 className="font-bold text-white mb-6">Shop</h3>
						<ul className="space-y-3 text-sm">
							<li>
								<Link
									href="/products"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									All Products
								</Link>
							</li>
							<li>
								<Link
									href="/deals"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Special Deals
								</Link>
							</li>
							<li>
								<Link
									href="/new-arrivals"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									New Arrivals
								</Link>
							</li>
							<li>
								<Link
									href="/categories"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Categories
								</Link>
							</li>
							<li>
								<Link
									href="/wishlist"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Wishlist
								</Link>
							</li>
						</ul>
					</div>

					{/* Customer Service */}
					<div>
						<h3 className="font-bold text-white mb-6">Support</h3>
						<ul className="space-y-3 text-sm">
							<li>
								<Link
									href="/contact"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Contact Us
								</Link>
							</li>
							<li>
								<Link
									href="/shipping"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Shipping Info
								</Link>
							</li>
							<li>
								<Link
									href="/returns"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Returns
								</Link>
							</li>
							<li>
								<Link
									href="/help"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									FAQs
								</Link>
							</li>
							<li>
								<Link
									href="/privacy"
									className="text-zinc-400 hover:text-emerald-500 transition-colors">
									Privacy Policy
								</Link>
							</li>
						</ul>
					</div>

					{/* Contact */}
					<div>
						<h3 className="font-bold text-white mb-6">Contact</h3>
						<ul className="space-y-4 text-sm text-zinc-400">
							{s.store_phone && (
								<li className="flex items-start">
									<Phone className="w-4 h-4 mr-3 mt-0.5 text-emerald-500 flex-shrink-0" />
									<span>{s.store_phone}</span>
								</li>
							)}
							{s.store_email && (
								<li className="flex items-start">
									<Mail className="w-4 h-4 mr-3 mt-0.5 text-emerald-500 flex-shrink-0" />
									<span>{s.store_email}</span>
								</li>
							)}
							{s.store_address && (
								<li className="flex items-start">
									<MapPin className="w-4 h-4 mr-3 mt-0.5 text-emerald-500 flex-shrink-0" />
									<span style={{ whiteSpace: "pre-line" }}>{s.store_address}</span>
								</li>
							)}
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className="mt-16 pt-8 border-t border-zinc-800">
					<div className="flex flex-col md:flex-row items-center justify-between gap-6">
						<div>
							<p className="text-xs text-zinc-500 mb-3">
								Secure Payment Methods
							</p>
							<div className="flex flex-wrap gap-2">
								{["VISA", "Mastercard", "AMEX", "PayPal"].map((method) => (
									<div
										key={method}
										className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
										{method}
									</div>
								))}
							</div>
						</div>
						<div className="text-sm text-zinc-500">
							&copy; {year} {s.store_name}. All rights reserved.
						</div>
					</div>

					{/* Legal Links */}
					<div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
						<Link
							href="/privacy"
							className="hover:text-emerald-500 transition-colors">
							Privacy Policy
						</Link>
						<span>&bull;</span>
						<Link
							href="/terms"
							className="hover:text-emerald-500 transition-colors">
							Terms of Service
						</Link>
						<span>&bull;</span>
						<Link
							href="/help"
							className="hover:text-emerald-500 transition-colors">
							Help Center
						</Link>
						<span>&bull;</span>
						<Link
							href="/about"
							className="hover:text-emerald-500 transition-colors">
							About Us
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
