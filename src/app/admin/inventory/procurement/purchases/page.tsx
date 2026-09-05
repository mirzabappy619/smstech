"use client";

import { PurchaseListPanel } from "../history-panels";
import { useWarehouses } from "../shared";

export default function PurchaseListPage() {
	const warehouses = useWarehouses();
	return <PurchaseListPanel warehouses={warehouses} />;
}
