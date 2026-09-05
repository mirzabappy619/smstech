"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The five screens that used to be tabs on one page. They are separate routes
 * now — each keeps its own form state, each is linkable, and a half-filled
 * purchase no longer disappears because someone glanced at the sell list.
 */
const SECTIONS = [
	{ href: "/admin/inventory/procurement/buy", label: "Buy / Receive Stock", icon: "📥" },
	{ href: "/admin/inventory/procurement/dispatch", label: "Wholesale Dispatch", icon: "📤" },
	{ href: "/admin/inventory/procurement/exchange", label: "Exchange / Trade-In", icon: "🔄" },
	{ href: "/admin/inventory/procurement/purchases", label: "Purchase List", icon: "📋" },
	{ href: "/admin/inventory/procurement/sales", label: "Sell List", icon: "🧾" },
];

export function ProcurementNav() {
	const pathname = usePathname();

	return (
		<div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
			{SECTIONS.map((section) => {
				const active = pathname === section.href;
				return (
					<Link
						key={section.href}
						href={section.href}
						aria-current={active ? "page" : undefined}
						className={`shrink-0 whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-bold transition-all ${
							active
								? "border-blue-600 text-blue-600 dark:text-blue-400"
								: "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
						}`}
					>
						{section.icon} {section.label}
					</Link>
				);
			})}
		</div>
	);
}
