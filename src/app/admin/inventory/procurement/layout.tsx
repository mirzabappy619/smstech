import Link from "next/link";
import { ProcurementNav } from "./nav";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Procurement",
};

export default function ProcurementLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-6">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
						Procurement, Dispatch &amp; Exchange
					</h1>
					<p className="text-sm text-zinc-500">
						Buy from suppliers, parties and walk-in customers; dispatch wholesale on
						payment or on credit; take devices in part-exchange.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Link
						href="/admin/customers"
						className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
					>
						Parties &amp; Customers
					</Link>
					<Link
						href="/admin/inventory/serialized"
						className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
					>
						← Serialized Inventory
					</Link>
				</div>
			</div>

			<ProcurementNav />

			{children}
		</div>
	);
}
