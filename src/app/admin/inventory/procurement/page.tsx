"use client";

import { useState, useEffect, useMemo } from "react";
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

interface PartyOption {
  id: string;
  party_type: "customer" | "supplier";
  customer_type: "retail" | "wholesale" | null;
  name: string;
  company_name: string | null;
  code: string | null;
  phone: string | null;
  credit_limit: number;
  balance: number;
}

/** One product line on the intake side. */
interface BuyLine {
  key: string;
  product_id: string;
  mode: "serialized" | "bulk";
  unit_cost: string;
  selling_price: string;
  warranty_months: string;
  /** Serialized: one unit per line, "serial" or "serial, imei1, imei2". */
  serials_text: string;
  /** Bulk: pooled quantity. */
  quantity: string;
}

/** One product line on the dispatch side. */
interface SellLine {
  key: string;
  product_id: string;
  quantity: string;
  unit_price: string;
}

const fmt = (n: number) => formatBDT(n);

const newKey = () => Math.random().toString(36).slice(2, 9);

const emptyBuyLine = (): BuyLine => ({
  key: newKey(),
  product_id: "",
  mode: "serialized",
  unit_cost: "",
  selling_price: "",
  warranty_months: "12",
  serials_text: "",
  quantity: "1",
});

const emptySellLine = (): SellLine => ({
  key: newKey(),
  product_id: "",
  quantity: "1",
  unit_price: "",
});

/** Units on a serialized line: one per non-empty row of the textarea. */
function parseSerials(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, imei1, imei2] = line.split(",").map((part) => part.trim());
      return { serial, imei1: imei1 || null, imei2: imei2 || null };
    })
    .filter((unit) => unit.serial);
}

function buyLineUnits(line: BuyLine): number {
  return line.mode === "serialized"
    ? parseSerials(line.serials_text).length
    : Number(line.quantity) || 0;
}

function buyLineTotal(line: BuyLine): number {
  return (Number(line.unit_cost) || 0) * buyLineUnits(line);
}

function sellLineTotal(line: SellLine): number {
  return (Number(line.unit_price) || 0) * (Number(line.quantity) || 0);
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Batch Buy ─────────────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [buyLines, setBuyLines] = useState<BuyLine[]>([emptyBuyLine()]);
  const [buyNotes, setBuyNotes] = useState("");

  // ── Batch Sell ────────────────────────────────────────────────────────────
  const [sellPartyId, setSellPartyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sellLines, setSellLines] = useState<SellLine[]>([emptySellLine()]);
  const [amountPaid, setAmountPaid] = useState("");
  const [sellOnDue, setSellOnDue] = useState(false);
  const [sellNotes, setSellNotes] = useState("");

  const suppliers = useMemo(
    () => parties.filter((p) => p.party_type === "supplier"),
    [parties],
  );
  const sellParties = useMemo(
    () => parties.filter((p) => p.party_type === "customer"),
    [parties],
  );
  const selectedSellParty = useMemo(
    () => sellParties.find((p) => p.id === sellPartyId) || null,
    [sellParties, sellPartyId],
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, whRes, partyRes] = await Promise.all([
          fetch("/api/v1/products?show_all=true&limit=100"),
          fetch("/api/v1/admin/warehouses"),
          fetch("/api/v1/admin/parties?limit=300"),
        ]);
        const [prodJson, whJson, partyJson] = await Promise.all([
          prodRes.json(),
          whRes.json(),
          partyRes.json(),
        ]);
        if (prodJson.success) setProducts(prodJson.data || []);
        if (whJson.success && whJson.data?.length > 0) {
          setWarehouses(whJson.data);
          setWarehouseId(whJson.data[0].id);
        }
        if (partyJson.success) setParties(partyJson.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  const buyTotal = useMemo(
    () => buyLines.reduce((sum, l) => sum + buyLineTotal(l), 0),
    [buyLines],
  );
  const buyUnits = useMemo(
    () => buyLines.reduce((sum, l) => sum + buyLineUnits(l), 0),
    [buyLines],
  );
  const sellTotal = useMemo(
    () => sellLines.reduce((sum, l) => sum + sellLineTotal(l), 0),
    [sellLines],
  );

  // Paying nothing up front is the same as putting the whole order on due, so
  // the two inputs stay in step rather than contradicting each other.
  const paidNow = sellOnDue ? Number(amountPaid) || 0 : sellTotal;
  const dueNow = Math.max(0, Math.round((sellTotal - paidNow) * 100) / 100);
  const headroom = selectedSellParty
    ? selectedSellParty.credit_limit - selectedSellParty.balance
    : 0;
  const overLimit = dueNow > 0 && selectedSellParty !== null && dueNow > headroom + 0.01;

  const updateBuyLine = (key: string, patch: Partial<BuyLine>) =>
    setBuyLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const updateSellLine = (key: string, patch: Partial<SellLine>) =>
    setSellLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleBatchBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      alert("Choose the branch this stock is landing in.");
      return;
    }

    const items = [];
    for (const [index, line] of buyLines.entries()) {
      const position = `Line ${index + 1}`;
      if (!line.product_id) {
        alert(`${position}: choose a product.`);
        return;
      }
      if (!line.unit_cost) {
        alert(`${position}: enter a cost price.`);
        return;
      }

      const warrantyMonths = Number(line.warranty_months);
      if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 120) {
        alert(`${position}: warranty must be a whole number of months between 0 and 120.`);
        return;
      }

      if (line.mode === "serialized") {
        const serials = parseSerials(line.serials_text);
        if (serials.length === 0) {
          alert(`${position}: enter at least one serial number, one per line.`);
          return;
        }
        if (!line.selling_price) {
          alert(`${position}: serialized units need a selling price.`);
          return;
        }
        items.push({
          product_id: line.product_id,
          unit_cost: Number(line.unit_cost),
          selling_price: Number(line.selling_price),
          warranty_months: warrantyMonths,
          serial_numbers: serials.map((u) => ({
            serial: u.serial,
            imei1: u.imei1,
            imei2: u.imei2,
            grade: "Like New A+",
            battery_health: 95,
            cycles: 40,
            variant: "Official",
          })),
        });
      } else {
        const quantity = Number(line.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          alert(`${position}: bulk lines need a whole quantity of 1 or more.`);
          return;
        }
        items.push({
          product_id: line.product_id,
          quantity,
          unit_cost: Number(line.unit_cost),
        });
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/inventory/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "batch_buy",
          supplier_id: supplierId || undefined,
          supplier_name:
            suppliers.find((s) => s.id === supplierId)?.name ||
            supplierName ||
            "Direct Supplier Intake",
          warehouse_id: warehouseId,
          notes: buyNotes,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Success: ${json.message}`);
        setBuyLines([emptyBuyLine()]);
        setBuyNotes("");
      } else {
        alert(json.error || "Batch intake failed");
      }
    } catch {
      alert("Error submitting batch buy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const partyName = selectedSellParty?.name || clientName;
    if (!partyName) {
      alert("Pick a registered party, or type the client's name.");
      return;
    }
    if (!warehouseId) {
      alert("Choose the branch the stock is leaving from.");
      return;
    }
    if (dueNow > 0 && !selectedSellParty) {
      alert(
        "Selling on due needs a registered party — pick one, or add them under Customer Management first.",
      );
      return;
    }
    if (overLimit) {
      alert(
        `That due is over ${selectedSellParty?.name}'s remaining credit of ${fmt(headroom)}.`,
      );
      return;
    }

    const items = [];
    for (const [index, line] of sellLines.entries()) {
      const position = `Line ${index + 1}`;
      if (!line.product_id) {
        alert(`${position}: choose a product.`);
        return;
      }
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      if (!Number.isInteger(quantity) || quantity < 1) {
        alert(`${position}: quantity must be a whole number of 1 or more.`);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        alert(`${position}: enter a unit price.`);
        return;
      }
      items.push({
        product_id: line.product_id,
        product_name:
          products.find((p) => p.id === line.product_id)?.name || "Wholesale item",
        quantity,
        unit_price: unitPrice,
      });
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/inventory/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "batch_sell",
          customer_id: selectedSellParty?.id || undefined,
          customer_name: partyName,
          customer_phone: selectedSellParty?.phone || clientPhone || "01700000000",
          warehouse_id: warehouseId,
          amount_paid: paidNow,
          notes: sellNotes,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Wholesale Order Created: ${json.message}`);
        setSellLines([emptySellLine()]);
        setClientName("");
        setClientPhone("");
        setSellPartyId("");
        setAmountPaid("");
        setSellOnDue(false);
        setSellNotes("");
      } else {
        alert(json.error || "Batch sell dispatch failed");
      }
    } catch {
      alert("Error submitting wholesale dispatch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-white";
  const labelClass = "block font-bold text-zinc-700 dark:text-zinc-300 mb-1";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Batch Procurement &amp; Wholesale Dispatch
          </h1>
          <p className="text-sm text-zinc-500">
            Multi-product bulk intake from suppliers and B2B dispatch, on payment or on due.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/customers"
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
          >
            Parties &amp; Customers
          </Link>
          <Link
            href="/admin/inventory/serialized"
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
          >
            ← Serialized Inventory
          </Link>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("buy")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "buy"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500"
          }`}
        >
          📥 Batch Buy Intake (Suppliers)
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === "sell"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500"
          }`}
        >
          📤 Batch Sell Dispatch (Corporate / Wholesale)
        </button>
      </div>

      {activeTab === "buy" ? (
        <form
          onSubmit={handleBatchBuySubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 max-w-5xl"
        >
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">
            Supplier Purchase Batch Intake
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className={labelClass}>Registered Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={fieldClass}
              >
                <option value="">-- Not registered / one-off --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.balance > 0 ? ` — owed ${fmt(s.balance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {supplierId ? "Supplier (from record)" : "Supplier Party Name"}
              </label>
              <input
                type="text"
                value={suppliers.find((s) => s.id === supplierId)?.name || supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={!!supplierId}
                placeholder="e.g. Dubai Wholesale Lot / Star Tech Supply"
                className={`${fieldClass} disabled:opacity-60`}
              />
            </div>
            <div>
              <label className={labelClass}>Destination Branch *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={fieldClass}
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product lines */}
          <div className="space-y-4">
            {buyLines.map((line, index) => (
              <div
                key={line.key}
                className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs bg-zinc-50/60 dark:bg-zinc-800/20"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-zinc-500 uppercase tracking-wider text-[10px]">
                    Line {index + 1}
                    {buyLineUnits(line) > 0 && ` · ${buyLineUnits(line)} unit(s) · ${fmt(buyLineTotal(line))}`}
                  </span>
                  {buyLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBuyLines((prev) => prev.filter((l) => l.key !== line.key))
                      }
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Catalog Product *</label>
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value);
                        updateBuyLine(line.key, {
                          product_id: e.target.value,
                          unit_cost: product
                            ? String(Math.round(product.base_price * 0.85))
                            : line.unit_cost,
                          selling_price: product
                            ? String(Math.round(product.base_price))
                            : line.selling_price,
                        });
                      }}
                      className={fieldClass}
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({fmt(p.base_price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Stock Type</label>
                    <select
                      value={line.mode}
                      onChange={(e) =>
                        updateBuyLine(line.key, {
                          mode: e.target.value as BuyLine["mode"],
                        })
                      }
                      className={fieldClass}
                    >
                      <option value="serialized">Serialized (per device)</option>
                      <option value="bulk">Bulk / pooled quantity</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Warranty (months)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={line.warranty_months}
                      onChange={(e) =>
                        updateBuyLine(line.key, { warranty_months: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Cost Price Per Unit *</label>
                    <input
                      type="number"
                      value={line.unit_cost}
                      onChange={(e) => updateBuyLine(line.key, { unit_cost: e.target.value })}
                      placeholder="e.g. 48000"
                      className={`${fieldClass} text-blue-600`}
                      required
                    />
                  </div>

                  {line.mode === "serialized" ? (
                    <div>
                      <label className={labelClass}>Selling Price Per Unit *</label>
                      <input
                        type="number"
                        value={line.selling_price}
                        onChange={(e) =>
                          updateBuyLine(line.key, { selling_price: e.target.value })
                        }
                        placeholder="e.g. 58000"
                        className={fieldClass}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Quantity *</label>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateBuyLine(line.key, { quantity: e.target.value })}
                        className={fieldClass}
                        required
                      />
                    </div>
                  )}

                  <div className="flex items-end">
                    <p className="text-[10px] text-zinc-500 leading-snug">
                      The warranty clock starts when the unit is sold, not now.
                      0 means sold as-is.
                    </p>
                  </div>
                </div>

                {line.mode === "serialized" && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className={labelClass}>
                        Serial Numbers — 1 per line, optionally{" "}
                        <span className="font-mono">serial, IMEI 1, IMEI 2</span>
                      </label>
                      <span className="font-mono text-zinc-500 font-bold">
                        {parseSerials(line.serials_text).length} units
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={line.serials_text}
                      onChange={(e) =>
                        updateBuyLine(line.key, { serials_text: e.target.value })
                      }
                      placeholder="SN00192831, 358992019283741, 358992019283742&#10;SN00192832&#10;SN00192833"
                      className={`${fieldClass} font-mono uppercase`}
                    />
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setBuyLines((prev) => [...prev, emptyBuyLine()])}
              className="px-4 py-2 border border-dashed border-zinc-400 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              + Add another product
            </button>
          </div>

          <div className="text-xs">
            <label className={labelClass}>Procurement Notes / Batch Bill Ref</label>
            <input
              type="text"
              value={buyNotes}
              onChange={(e) => setBuyNotes(e.target.value)}
              placeholder="e.g. Invoice #DXB-994, payment terms 30 days"
              className={fieldClass}
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex justify-between items-center text-xs font-bold">
            <span>
              {buyLines.length} line(s) · {buyUnits} unit(s) — Estimated Bill:
            </span>
            <span className="text-blue-600 text-sm font-black">{fmt(buyTotal)}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Recording intake..." : "Record Batch Intake"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleBatchSellSubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 max-w-5xl"
        >
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">
            Corporate / Wholesale Dispatch
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className={labelClass}>Registered Party</label>
              <select
                value={sellPartyId}
                onChange={(e) => setSellPartyId(e.target.value)}
                className={fieldClass}
              >
                <option value="">-- Not registered / walk-in --</option>
                {sellParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.customer_type === "wholesale" ? " (wholesale)" : ""}
                    {p.balance > 0 ? ` — owes ${fmt(p.balance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {selectedSellParty ? "Party (from record)" : "Client Name *"}
              </label>
              <input
                type="text"
                value={selectedSellParty?.name || clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={!!selectedSellParty}
                placeholder="e.g. Brac Bank IT Procurement"
                className={`${fieldClass} disabled:opacity-60`}
              />
            </div>
            <div>
              <label className={labelClass}>Dispatch From Branch *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={fieldClass}
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedSellParty && (
            <div className="text-xs max-w-xs">
              <label className={labelClass}>Client Phone</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className={fieldClass}
              />
            </div>
          )}

          {/* Product lines */}
          <div className="space-y-3">
            {sellLines.map((line, index) => (
              <div
                key={line.key}
                className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/60 dark:bg-zinc-800/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-zinc-500 uppercase tracking-wider text-[10px]">
                    Line {index + 1} · {fmt(sellLineTotal(line))}
                  </span>
                  {sellLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSellLines((prev) => prev.filter((l) => l.key !== line.key))
                      }
                      className="text-rose-600 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Product *</label>
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value);
                        updateSellLine(line.key, {
                          product_id: e.target.value,
                          unit_price: product ? String(product.base_price) : line.unit_price,
                        });
                      }}
                      className={fieldClass}
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({fmt(p.base_price)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateSellLine(line.key, { quantity: e.target.value })}
                      className={fieldClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Unit Price *</label>
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) =>
                        updateSellLine(line.key, { unit_price: e.target.value })
                      }
                      className={`${fieldClass} text-blue-600`}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setSellLines((prev) => [...prev, emptySellLine()])}
              className="px-4 py-2 border border-dashed border-zinc-400 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              + Add another product
            </button>
          </div>

          {/* Settlement */}
          <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
            <label className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={sellOnDue}
                onChange={(e) => {
                  setSellOnDue(e.target.checked);
                  if (!e.target.checked) setAmountPaid("");
                }}
                className="h-4 w-4"
              />
              Sell on due (part or all of this order stays owed)
            </label>

            {sellOnDue && (
              <>
                <div className="max-w-xs">
                  <label className={labelClass}>Paid Now (BDT)</label>
                  <input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0 for the whole order on due"
                    className={fieldClass}
                  />
                </div>

                {selectedSellParty ? (
                  <p
                    className={`font-bold ${
                      overLimit ? "text-rose-600" : "text-zinc-500"
                    }`}
                  >
                    {selectedSellParty.name} owes {fmt(selectedSellParty.balance)} of a{" "}
                    {fmt(selectedSellParty.credit_limit)} limit — {fmt(headroom)} of credit
                    left.
                    {overLimit && ` This due of ${fmt(dueNow)} is over that.`}
                  </p>
                ) : (
                  <p className="font-bold text-amber-600">
                    Pick a registered party above. A due has to be owed by someone the
                    shop can look up — add them under Customer Management if they are new.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="text-xs">
            <label className={labelClass}>Dispatch Notes</label>
            <input
              type="text"
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              placeholder="e.g. PO #4471, deliver to Gulshan office"
              className={fieldClass}
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl space-y-1 text-xs font-bold">
            <div className="flex justify-between items-center">
              <span>{sellLines.length} line(s) — Order Total:</span>
              <span className="text-blue-600 text-sm font-black">{fmt(sellTotal)}</span>
            </div>
            {dueNow > 0 && (
              <>
                <div className="flex justify-between items-center text-emerald-600">
                  <span>Paid now:</span>
                  <span>{fmt(paidNow)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600">
                  <span>On due:</span>
                  <span>{fmt(dueNow)}</span>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || overLimit}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting
              ? "Dispatching..."
              : dueNow > 0
                ? `Dispatch — ${fmt(dueNow)} on due`
                : "Dispatch Wholesale Order"}
          </button>
        </form>
      )}
    </div>
  );
}
