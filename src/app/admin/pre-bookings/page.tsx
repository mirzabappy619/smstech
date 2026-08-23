"use client";

import { useState, useEffect } from "react";


interface PreBooking {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  queue_priority: number;
  total_price: number;
  advance_paid: number;
  remaining_due: number;
  payment_method: string;
  payment_status: string;
  status: "queued" | "allocated" | "ready_for_pickup" | "fulfilled" | "cancelled";
  created_at: string;
  products: {
    id: string;
    name: string;
    brand: string;
  };
}

const fmt = (n: number) => "৳" + (Number(n) || 0).toLocaleString("en-BD");

export default function PreBookingsAdminPage() {
  const [bookings, setBookings] = useState<PreBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/pre-bookings");
      const json = await res.json();
      if (json.success) setBookings(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoAllocation = async () => {
    setAllocating(true);
    try {
      const res = await fetch("/api/v1/admin/pre-bookings/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchBookings();
      } else {
        alert(json.error || "Allocation failed");
      }
    } catch (err) {
      alert("Allocation request error");
    } finally {
      setAllocating(false);
    }
  };

  const filtered = (bookings || []).filter(b => statusFilter === "all" || b?.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Pre-Booking Engine & Queue Priority</h1>
          <p className="text-sm text-zinc-500">Track customer pre-orders, advance deposits, priority ranking, and automated stock allocations.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerAutoAllocation}
            disabled={allocating}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span>⚡</span> {allocating ? "Matching Serials..." : "Auto-Allocate Stock to Queue"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Total Pre-Orders</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{(bookings || []).length}</p>
        </div>
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Waiting in Queue</p>
          <p className="text-2xl font-black text-amber-500 mt-1">
            {(bookings || []).filter(b => b?.status === "queued").length}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Allocated Units</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {(bookings || []).filter(b => b?.status === "allocated" || b?.status === "ready_for_pickup").length}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Total Advance Collected</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {fmt((bookings || []).reduce((s, b) => s + (Number(b?.advance_paid) || 0), 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {(["all", "queued", "allocated", "ready_for_pickup", "fulfilled"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all capitalize ${
              statusFilter === tab ? "border-blue-600 text-blue-600 dark:text-blue-400 font-black" : "border-transparent text-zinc-500"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading pre-booking queue...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <span className="text-3xl">⏳</span>
            <p className="font-bold text-sm mt-2">No Pre-Bookings Found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Queue Rank</th>
                  <th className="px-4 py-3.5">Booking #</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Total Price</th>
                  <th className="px-4 py-3.5">Advance Paid</th>
                  <th className="px-4 py-3.5">Remaining Due</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black flex items-center justify-center text-xs">
                        #{b.queue_priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-white">
                      {b.booking_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-zinc-900 dark:text-white">{b.customer_name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">{b.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {b.products?.name}
                    </td>
                    <td className="px-4 py-3 font-bold">{fmt(b.total_price)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{fmt(b.advance_paid)}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">{fmt(b.remaining_due)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                        b.status === "allocated"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : b.status === "ready_for_pickup"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : b.status === "fulfilled"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(b.created_at).toLocaleDateString("en-BD")}
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
