"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { formatBDT } from "@/lib/currency";

const fmt = (n: number) => formatBDT(n);

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const FILTER =
  "px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white";

interface BillItem {
  id: string;
  product_name: string;
  is_serialized: boolean;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

interface PurchaseBill {
  id: string;
  bill_number: string;
  party_type: "supplier" | "customer" | "walk_in";
  party_name: string;
  subtotal: number;
  amount_paid: number;
  due_amount: number;
  unit_count: number;
  exchange_order_id: string | null;
  notes: string | null;
  created_at: string;
  warehouses: { id: string; name: string; code: string } | null;
  items: BillItem[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

const PARTY_LABEL: Record<PurchaseBill["party_type"], string> = {
  supplier: "Supplier",
  customer: "Customer / party",
  walk_in: "Walk-in",
};

/** Every intake, whoever the goods came from. */
export function PurchaseListPanel({ warehouses }: { warehouses: Warehouse[] }) {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, outstanding: 0, units: 0 });
  const [loading, setLoading] = useState(true);
  const [partyType, setPartyType] = useState("all");
  const [warehouseId, setWarehouseId] = useState("all");
  const [settled, setSettled] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (partyType !== "all") params.set("party_type", partyType);
      if (warehouseId !== "all") params.set("warehouse_id", warehouseId);
      if (settled !== "all") params.set("settled", settled);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/v1/admin/inventory/purchases?${params}`);
      const json = await res.json();
      if (json.success) {
        setBills(json.data || []);
        setSummary(json.summary || { count: 0, total: 0, outstanding: 0, units: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [partyType, warehouseId, settled, search]);

  useEffect(() => {
    fetchBills();
  }, [partyType, warehouseId, settled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Bills" value={String(summary.count)} />
        <Stat label="Units Received" value={String(summary.units)} />
        <Stat label="Purchase Value" value={fmt(summary.total)} tone="text-blue-600" />
        <Stat
          label="Still Owed"
          value={fmt(summary.outstanding)}
          tone={summary.outstanding > 0 ? "text-amber-600" : "text-zinc-400"}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchBills();
          }}
          className="flex-1 min-w-[200px]"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill number or party..."
            className={`${FILTER} w-full`}
          />
        </form>

        <select value={partyType} onChange={(e) => setPartyType(e.target.value)} className={FILTER}>
          <option value="all">All Sources</option>
          <option value="supplier">Suppliers</option>
          <option value="customer">Customers / parties</option>
          <option value="walk_in">Walk-ins</option>
        </select>

        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className={FILTER}
        >
          <option value="all">All Branches</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select value={settled} onChange={(e) => setSettled(e.target.value)} className={FILTER}>
          <option value="all">Paid &amp; unpaid</option>
          <option value="due">Still owed</option>
          <option value="paid">Settled</option>
        </select>

        <button
          onClick={fetchBills}
          className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold"
        >
          Search
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading purchases...</div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
              No purchases recorded yet
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Bills appear here as stock is received on the Buy tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Bill</th>
                  <th className="px-4 py-3.5">From</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Units</th>
                  <th className="px-4 py-3.5">Total</th>
                  <th className="px-4 py-3.5">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {bills.map((bill) => (
                  <Fragment key={bill.id}>
                    <tr
                      onClick={() => setExpanded(expanded === bill.id ? null : bill.id)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-zinc-900 dark:text-white font-mono">
                          {bill.bill_number}
                        </p>
                        <p className="text-[10px] text-zinc-500">{when(bill.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-zinc-900 dark:text-white">
                          {bill.party_name}
                        </p>
                        <span className="text-[10px] text-zinc-500">
                          {PARTY_LABEL[bill.party_type]}
                          {bill.exchange_order_id ? " · part-exchange" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {bill.warehouses?.name || "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-300">
                        {bill.unit_count}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-white">
                        {fmt(bill.subtotal)}
                      </td>
                      <td className="px-4 py-3">
                        {bill.due_amount > 0 ? (
                          <>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {fmt(bill.due_amount)} owed
                            </span>
                            <p className="text-[10px] text-zinc-500 mt-1">
                              {fmt(bill.amount_paid)} paid
                            </p>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded === bill.id && (
                      <tr className="bg-zinc-50/70 dark:bg-zinc-800/30">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="space-y-1">
                            {(bill.items || []).map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-300"
                              >
                                <span>
                                  {item.product_name}
                                  <span className="text-zinc-400">
                                    {" "}
                                    · {item.quantity} ×{" "}
                                    {item.is_serialized ? "serialized" : "bulk"} @{" "}
                                    {fmt(item.unit_cost)}
                                  </span>
                                </span>
                                <span className="font-bold">{fmt(item.line_total)}</span>
                              </div>
                            ))}
                            {bill.notes && (
                              <p className="text-[10px] text-zinc-500 pt-1 italic">
                                {bill.notes}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface WholesaleOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  amount_paid: number;
  due_amount: number;
  trade_in_value: number;
  payment_status: string;
  invoice_type: string;
  created_at: string;
  warehouse_id: string | null;
}

/** Wholesale dispatches and part-exchanges — the sell side of the same story. */
export function SalesListPanel({ warehouses }: { warehouses: Warehouse[] }) {
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceType, setInvoiceType] = useState("b2b_wholesale,exchange");
  const [warehouseId, setWarehouseId] = useState("all");
  const [search, setSearch] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", invoice_type: invoiceType });
      if (warehouseId !== "all") params.set("warehouse_id", warehouseId);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/admin/orders?${params}`);
      const json = await res.json();
      if (json.success) setOrders(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [invoiceType, warehouseId, search]);

  useEffect(() => {
    fetchOrders();
  }, [invoiceType, warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const outstanding = orders.reduce((sum, o) => sum + Number(o.due_amount || 0), 0);
  const tradeIn = orders.reduce((sum, o) => sum + Number(o.trade_in_value || 0), 0);

  const branchName = (id: string | null) =>
    warehouses.find((w) => w.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Dispatch Value" value={fmt(total)} tone="text-emerald-600" />
        <Stat
          label="Taken in Part-Exchange"
          value={fmt(tradeIn)}
          tone={tradeIn > 0 ? "text-amber-600" : "text-zinc-400"}
        />
        <Stat
          label="Still Owed"
          value={fmt(outstanding)}
          tone={outstanding > 0 ? "text-rose-600" : "text-zinc-400"}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchOrders();
          }}
          className="flex-1 min-w-[200px]"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number or party..."
            className={`${FILTER} w-full`}
          />
        </form>

        <select
          value={invoiceType}
          onChange={(e) => setInvoiceType(e.target.value)}
          className={FILTER}
        >
          <option value="b2b_wholesale,exchange">Wholesale &amp; exchanges</option>
          <option value="b2b_wholesale">Wholesale only</option>
          <option value="exchange">Exchanges only</option>
        </select>

        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className={FILTER}
        >
          <option value="all">All Branches</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold"
        >
          Search
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading dispatches...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
              Nothing dispatched yet
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Wholesale orders and part-exchanges appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Order</th>
                  <th className="px-4 py-3.5">Party</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Kind</th>
                  <th className="px-4 py-3.5">Total</th>
                  <th className="px-4 py-3.5">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-zinc-900 dark:text-white font-mono">
                        {order.order_number}
                      </p>
                      <p className="text-[10px] text-zinc-500">{when(order.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {branchName(order.warehouse_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          order.invoice_type === "exchange"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                        }`}
                      >
                        {order.invoice_type === "exchange" ? "Exchange" : "Wholesale"}
                      </span>
                      {Number(order.trade_in_value) > 0 && (
                        <p className="text-[10px] text-zinc-500 mt-1">
                          {fmt(Number(order.trade_in_value))} traded in
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-white">
                      {fmt(Number(order.total))}
                    </td>
                    <td className="px-4 py-3">
                      {Number(order.due_amount) > 0 ? (
                        <>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            {fmt(Number(order.due_amount))} due
                          </span>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {fmt(Number(order.amount_paid))} paid
                          </p>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Paid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-zinc-900 dark:text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
