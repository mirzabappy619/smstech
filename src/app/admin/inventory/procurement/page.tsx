"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatBDT } from "@/lib/currency";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  base_price: number;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

const fmt = (n: number) => formatBDT(n);

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  // Batch Buy State
  const [supplierName, setSupplierName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [serialInputText, setSerialInputText] = useState(""); // Multi-line serial input
  const [buyNotes, setBuyNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch Sell State
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sellProductId, setSellProductId] = useState("");
  const [sellQty, setSellQty] = useState("5");
  const [sellUnitPrice, setSellUnitPrice] = useState("");
  const [sellNotes, setSellNotes] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, whRes] = await Promise.all([
          fetch("/api/v1/products?show_all=true&limit=100"),
          fetch("/api/v1/admin/warehouses")
        ]);
        const [prodJson, whJson] = await Promise.all([prodRes.json(), whRes.json()]);
        if (prodJson.success) setProducts(prodJson.data || []);
        if (whJson.success && whJson.data?.length > 0) {
          setWarehouses(whJson.data);
          setWarehouseId(whJson.data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  const handleBatchBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !warehouseId || !unitCost || !sellingPrice) {
      alert("Fill in Product, Destination Branch, Cost Price and Selling Price.");
      return;
    }
    if (Number(sellingPrice) <= Number(unitCost)) {
      if (!confirm(
        `Selling price ${fmt(Number(sellingPrice))} is not above the ${fmt(Number(unitCost))} cost. Continue anyway?`
      )) {
        return;
      }
    }

    const serials = serialInputText
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    if (serials.length === 0) {
      alert("Please enter at least 1 serial number (one per line).");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type: "batch_buy",
        supplier_name: supplierName || "Direct Supplier Intake",
        warehouse_id: warehouseId,
        notes: buyNotes,
        items: [
          {
            product_id: selectedProductId,
            unit_cost: Number(unitCost),
            selling_price: Number(sellingPrice),
            serial_numbers: serials.map(s => ({
              serial: s,
              grade: "Like New A+",
              battery_health: 95,
              cycles: 40,
              variant: "Official"
            }))
          }
        ]
      };

      const res = await fetch("/api/v1/admin/inventory/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert(`Success: ${json.message}`);
        setSerialInputText("");
        setUnitCost("");
        setSellingPrice("");
      } else {
        alert(json.error || "Batch intake failed");
      }
    } catch (err) {
      alert("Error submitting batch buy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !sellProductId || !sellQty || !sellUnitPrice) {
      alert("Please fill in Corporate Client Name, Product, Quantity, and Price.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type: "batch_sell",
        customer_name: clientName,
        customer_phone: clientPhone || "01700000000",
        warehouse_id: warehouseId,
        payment_status: "paid",
        notes: sellNotes,
        items: [
          {
            product_id: sellProductId,
            product_name: products.find(x => x.id === sellProductId)?.name || "Wholesale item",
            quantity: Number(sellQty),
            unit_price: Number(sellUnitPrice)
          }
        ]
      };

      const res = await fetch("/api/v1/admin/inventory/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert(`Wholesale Order Created: ${json.message}`);
        setClientName("");
      } else {
        alert(json.error || "Batch sell dispatch failed");
      }
    } catch (err) {
      alert("Error submitting wholesale dispatch");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Batch Procurement & Wholesale Dispatch</h1>
          <p className="text-sm text-zinc-500">Single-screen bulk inventory intake from suppliers and B2B corporate invoice dispatch.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/inventory/serialized" className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300">
            ← Serialized Inventory
          </Link>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("buy")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "buy" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500"
          }`}
        >
          📥 Batch Buy Intake (Suppliers)
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "sell" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500"
          }`}
        >
          📤 Batch Sell Dispatch (Corporate / Wholesale)
        </button>
      </div>

      {/* Main Single-Screen Form */}
      {activeTab === "buy" ? (
        <form onSubmit={handleBatchBuySubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Supplier Purchase Batch Intake</h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Supplier Party Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. Dubai Wholesale Lot / Star Tech Supply"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Destination Branch *</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                required
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select Catalog Product *</label>
              <select
                value={selectedProductId}
                onChange={e => {
                  setSelectedProductId(e.target.value);
                  const p = products.find(x => x.id === e.target.value);
                  if (p) {
                    setUnitCost(String(Math.round(p.base_price * 0.85)));
                    setSellingPrice(String(Math.round(p.base_price)));
                  }
                }}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({fmt(p.base_price)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Cost Price Per Unit (BDT) *</label>
              <input
                type="number"
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                placeholder="e.g. 48000"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-blue-600"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Selling Price Per Unit (BDT) *</label>
              {/* Required now. Intake used to invent one at cost × 1.15 when
                  this was left out, quietly setting every shelf price. */}
              <input
                type="number"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                placeholder="e.g. 56000"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-emerald-600"
                required
              />
              {Number(unitCost) > 0 && Number(sellingPrice) > 0 && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  Margin {fmt(Number(sellingPrice) - Number(unitCost))} per unit
                  {" · "}
                  {Math.round(((Number(sellingPrice) - Number(unitCost)) / Number(sellingPrice)) * 100)}%
                </p>
              )}
            </div>
          </div>

          <div className="text-xs">
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Paste Serial Numbers (1 per line or scan with barcode gun)
              </label>
              <span className="font-mono text-zinc-500 font-bold">
                Count: {serialInputText.split("\n").filter(s => s.trim()).length} Units
              </span>
            </div>
            <textarea
              rows={6}
              value={serialInputText}
              onChange={e => setSerialInputText(e.target.value)}
              placeholder="SN00192831&#10;SN00192832&#10;SN00192833"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono text-xs font-bold text-zinc-900 dark:text-white uppercase"
              required
            />
          </div>

          <div className="text-xs">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Procurement Notes / Batch Bill Ref</label>
            <input
              type="text"
              value={buyNotes}
              onChange={e => setBuyNotes(e.target.value)}
              placeholder="e.g. Invoice #DXB-994, payment terms 30 days"
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex justify-between items-center text-xs font-bold">
            <span>Estimated Total Bill Amount:</span>
            <span className="text-blue-600 text-sm font-black">
              {fmt((Number(unitCost) || 0) * serialInputText.split("\n").filter(s => s.trim()).length)}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Processing Batch Intake..." : "Confirm & Import Batch into Inventory"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBatchSellSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Corporate / Wholesale Batch Dispatch</h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Corporate Client / Reseller Name *</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Brain Station 23 Ltd"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Contact Phone</label>
              <input
                type="text"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="017..."
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select Product *</label>
              <select
                value={sellProductId}
                onChange={e => {
                  setSellProductId(e.target.value);
                  const p = products.find(x => x.id === e.target.value);
                  if (p) setSellUnitPrice(String(p.base_price));
                }}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Dispatching Branch</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Quantity *</label>
              <input
                type="number"
                value={sellQty}
                onChange={e => setSellQty(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Unit Selling Price (BDT) *</label>
              <input
                type="number"
                value={sellUnitPrice}
                onChange={e => setSellUnitPrice(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-blue-600"
                required
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Corporate Memo Notes</label>
            <input
              type="text"
              value={sellNotes}
              onChange={e => setSellNotes(e.target.value)}
              placeholder="PO #BS-2026-09"
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex justify-between items-center text-xs font-bold">
            <span>Total Wholesale Invoice Value:</span>
            <span className="text-emerald-600 text-sm font-black">
              {fmt((Number(sellUnitPrice) || 0) * (Number(sellQty) || 0))}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Dispatching..." : "Generate B2B Invoice & Dispatch"}
          </button>
        </form>
      )}
    </div>
  );
}
