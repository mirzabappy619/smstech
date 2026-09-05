"use client";

import { SalesListPanel } from "../history-panels";
import { useWarehouses } from "../shared";

export default function SellListPage() {
	const warehouses = useWarehouses();
	return <SalesListPanel warehouses={warehouses} />;
}
