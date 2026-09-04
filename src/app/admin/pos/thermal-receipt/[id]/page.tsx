"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatBDT } from "@/lib/currency";

interface OrderDetail {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  advance_deducted: number;
  due_amount: number;
  payment_method: string;
  payment_breakdown: Array<{ method: string; amount: number; reference?: string }>;
  items: Array<{
    id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    total: number;
    serial_number?: string;
    imei_1?: string;
    warranty_period?: string;
  }>;
}

const fmt = (n: number) => formatBDT(n);

export default function ThermalReceiptPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/v1/admin/orders/${orderId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setOrder(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (orderId) fetchOrder();
  }, [orderId]);

  if (loading) {
    return <div className="p-8 text-center font-mono text-xs">Loading receipt data...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center font-mono text-xs text-red-600">Order not found.</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-200 py-6 flex flex-col items-center print:bg-white print:p-0">
      {/* Controls Bar (Hidden during actual print) */}
      <div className="mb-4 bg-white p-3 rounded-xl shadow-md flex items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span>Paper Format:</span>
          <button
            onClick={() => setPaperWidth("80mm")}
            className={`px-3 py-1 rounded-lg border ${paperWidth === "80mm" ? "bg-blue-600 text-white border-blue-600" : "bg-zinc-100 border-zinc-300"}`}
          >
            80mm Standard
          </button>
          <button
            onClick={() => setPaperWidth("58mm")}
            className={`px-3 py-1 rounded-lg border ${paperWidth === "58mm" ? "bg-blue-600 text-white border-blue-600" : "bg-zinc-100 border-zinc-300"}`}
          >
            58mm Compact
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow"
        >
          🖨️ Print Receipt
        </button>
      </div>

      {/* Printable Thermal Receipt Container */}
      <div
        className={`bg-white text-black font-mono shadow-xl p-4 transition-all print:shadow-none print:p-0 ${
          paperWidth === "80mm" ? "w-[300px] text-[12px]" : "w-[220px] text-[10px]"
        }`}
      >
        {/* Receipt Header */}
        <div className="text-center pb-2 border-b border-dashed border-zinc-400">
          <h1 className="font-extrabold text-base tracking-wider uppercase">SMSTech Bangladesh</h1>
          <p className="text-[10px] text-zinc-700">Multiplan Center, Level-3, Shop 309</p>
          <p className="text-[10px] text-zinc-700">Elephant Road, Dhaka · 01781485588</p>
          <p className="text-[10px] font-bold mt-1">*** CASH / POS MEMO ***</p>
        </div>

        {/* Order Meta */}
        <div className="py-2 border-b border-dashed border-zinc-400 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>Invoice:</span>
            <span className="font-bold">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date(order.created_at).toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-bold">{order.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span>Phone:</span>
            <span>{order.customer_phone}</span>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="py-2 border-b border-dashed border-zinc-400">
          <div className="flex justify-between font-bold pb-1 border-b border-zinc-300">
            <span>Item</span>
            <span>Total</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {order.items?.map((it, idx) => (
              <div key={idx} className="py-1.5 space-y-0.5">
                <div className="flex justify-between font-semibold">
                  <span className="truncate pr-1">{it.product_name}</span>
                  <span className="shrink-0">{fmt(it.total || it.unit_price * it.quantity)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600">
                  <span>{it.quantity} x {fmt(it.unit_price)}</span>
                  {it.warranty_period && <span>Warranty: {it.warranty_period}</span>}
                </div>
                {(it.serial_number || it.imei_1) && (
                  <div className="text-[9px] bg-zinc-100 p-0.5 rounded text-zinc-800 font-bold">
                    {it.serial_number && <div>SN: {it.serial_number}</div>}
                    {it.imei_1 && <div>IMEI: {it.imei_1}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Totals & Split Payments */}
        <div className="py-2 border-b border-dashed border-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{fmt(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-zinc-700">
              <span>Discount:</span>
              <span>-{fmt(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-[13px] pt-1 border-t border-zinc-300">
            <span>NET PAYABLE:</span>
            <span>{fmt(order.total)}</span>
          </div>

          {/* Payment Breakdown */}
          <div className="pt-2 text-[10px] space-y-0.5">
            <p className="font-bold uppercase text-[9px] text-zinc-500">Tender Breakdown:</p>
            {order.payment_breakdown?.length ? (
              order.payment_breakdown.map((p, i) => (
                <div key={i} className="flex justify-between text-zinc-700">
                  <span className="capitalize">{p.method} {p.reference ? `(${p.reference})` : ""}:</span>
                  <span className="font-semibold">{fmt(p.amount)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-zinc-700">
                <span className="capitalize">{order.payment_method}:</span>
                <span className="font-semibold">{fmt(order.total)}</span>
              </div>
            )}

            {order.due_amount > 0 && (
              <div className="flex justify-between text-red-600 font-extrabold pt-1 border-t border-dotted">
                <span>REMAINING DUE:</span>
                <span>{fmt(order.due_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Warranty Disclaimer */}
        <div className="pt-3 text-center text-[9px] text-zinc-600 space-y-1">
          <p className="font-bold">Thank You For Choosing SMSTech!</p>
          <p>Please keep this invoice for all warranty claims.</p>
          <p>Goods once sold can only be serviced/replaced per standard brand & SMSTech policy.</p>
          <p className="pt-2 text-[8px] text-zinc-400">Software Powered by SMSTech POS Engine</p>
        </div>
      </div>
    </div>
  );
}
