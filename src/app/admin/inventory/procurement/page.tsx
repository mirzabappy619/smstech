"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatBDT } from "@/lib/currency";
import { PurchaseListPanel, SalesListPanel } from "./history-panels";
import { notify } from "@/components/ui/toast";

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
  advance_balance: number;
}

/** One product line of goods coming in. */
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

/** One product line of goods going out. */
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

const buyLineTotal = (line: BuyLine) => (Number(line.unit_cost) || 0) * buyLineUnits(line);
const sellLineTotal = (line: SellLine) =>
  (Number(line.unit_price) || 0) * (Number(line.quantity) || 0);

const FIELD =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-white";
const LABEL = "block font-bold text-zinc-700 dark:text-zinc-300 mb-1";

/** Goods-in line editor, shared by the buy and exchange screens. */
function BuyLinesEditor({
  lines,
  setLines,
  products,
  costLabel,
}: {
  lines: BuyLine[];
  setLines: React.Dispatch<React.SetStateAction<BuyLine[]>>;
  products: ProductOption[];
  costLabel: string;
}) {
  const update = (key: string, patch: Partial<BuyLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-4">
      {lines.map((line, index) => (
        <div
          key={line.key}
          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs bg-zinc-50/60 dark:bg-zinc-800/20"
        >
          <div className="flex items-center justify-between">
            <span className="font-black text-zinc-500 uppercase tracking-wider text-[10px]">
              Line {index + 1}
              {buyLineUnits(line) > 0 &&
                ` · ${buyLineUnits(line)} unit(s) · ${fmt(buyLineTotal(line))}`}
            </span>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                className="text-rose-600 font-bold hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className={LABEL}>Catalog Product *</label>
              <select
                value={line.product_id}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  update(line.key, {
                    product_id: e.target.value,
                    unit_cost: product
                      ? String(Math.round(product.base_price * 0.85))
                      : line.unit_cost,
                    selling_price: product
                      ? String(Math.round(product.base_price))
                      : line.selling_price,
                  });
                }}
                className={FIELD}
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
              <label className={LABEL}>Stock Type</label>
              <select
                value={line.mode}
                onChange={(e) =>
                  update(line.key, { mode: e.target.value as BuyLine["mode"] })
                }
                className={FIELD}
              >
                <option value="serialized">Serialized (per device)</option>
                <option value="bulk">Bulk / pooled quantity</option>
              </select>
            </div>

            <div>
              <label className={LABEL}>Warranty (months)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={line.warranty_months}
                onChange={(e) => update(line.key, { warranty_months: e.target.value })}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>{costLabel} *</label>
              <input
                type="number"
                value={line.unit_cost}
                onChange={(e) => update(line.key, { unit_cost: e.target.value })}
                placeholder="e.g. 48000"
                className={`${FIELD} text-blue-600`}
                required
              />
            </div>

            {line.mode === "serialized" ? (
              <div>
                <label className={LABEL}>Resale Price Per Unit *</label>
                <input
                  type="number"
                  value={line.selling_price}
                  onChange={(e) => update(line.key, { selling_price: e.target.value })}
                  placeholder="e.g. 58000"
                  className={FIELD}
                  required
                />
              </div>
            ) : (
              <div>
                <label className={LABEL}>Quantity *</label>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => update(line.key, { quantity: e.target.value })}
                  className={FIELD}
                  required
                />
              </div>
            )}

            <div className="flex items-end">
              <p className="text-[10px] text-zinc-500 leading-snug">
                The warranty clock starts when the unit is sold on, not now. 0 means
                sold as-is.
              </p>
            </div>
          </div>

          {line.mode === "serialized" && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={LABEL}>
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
                onChange={(e) => update(line.key, { serials_text: e.target.value })}
                placeholder="SN00192831, 358992019283741, 358992019283742&#10;SN00192832"
                className={`${FIELD} font-mono uppercase`}
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, emptyBuyLine()])}
        className="px-4 py-2 border border-dashed border-zinc-400 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        + Add another product
      </button>
    </div>
  );
}

/** Goods-out line editor, shared by the sell and exchange screens. */
function SellLinesEditor({
  lines,
  setLines,
  products,
}: {
  lines: SellLine[];
  setLines: React.Dispatch<React.SetStateAction<SellLine[]>>;
  products: ProductOption[];
}) {
  const update = (key: string, patch: Partial<SellLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div
          key={line.key}
          className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/60 dark:bg-zinc-800/20 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-black text-zinc-500 uppercase tracking-wider text-[10px]">
              Line {index + 1} · {fmt(sellLineTotal(line))}
            </span>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                className="text-rose-600 font-bold hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className={LABEL}>Product *</label>
              <select
                value={line.product_id}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  update(line.key, {
                    product_id: e.target.value,
                    unit_price: product ? String(product.base_price) : line.unit_price,
                  });
                }}
                className={FIELD}
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
              <label className={LABEL}>Quantity *</label>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
                className={FIELD}
                required
              />
            </div>
            <div>
              <label className={LABEL}>Unit Price *</label>
              <input
                type="number"
                value={line.unit_price}
                onChange={(e) => update(line.key, { unit_price: e.target.value })}
                className={`${FIELD} text-blue-600`}
                required
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, emptySellLine()])}
        className="px-4 py-2 border border-dashed border-zinc-400 dark:border-zinc-600 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        + Add another product
      </button>
    </div>
  );
}

/** Turns the buy-line editor's state into API line items. */
function buildIntakeItems(
  lines: BuyLine[],
): { error: string } | { items: Record<string, unknown>[] } {
  const items: Record<string, unknown>[] = [];

  for (const [index, line] of lines.entries()) {
    const position = `Line ${index + 1}`;
    if (!line.product_id) return { error: `${position}: choose a product.` };
    if (!line.unit_cost) return { error: `${position}: enter a price.` };

    const warrantyMonths = Number(line.warranty_months);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 120) {
      return {
        error: `${position}: warranty must be a whole number of months between 0 and 120.`,
      };
    }

    if (line.mode === "serialized") {
      const serials = parseSerials(line.serials_text);
      if (serials.length === 0) {
        return { error: `${position}: enter at least one serial number, one per line.` };
      }
      if (!line.selling_price) {
        return { error: `${position}: serialized units need a resale price.` };
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
        return { error: `${position}: bulk lines need a whole quantity of 1 or more.` };
      }
      items.push({
        product_id: line.product_id,
        quantity,
        unit_cost: Number(line.unit_cost),
      });
    }
  }

  return { items };
}

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<
    "buy" | "sell" | "exchange" | "purchase_list" | "sell_list"
  >("buy");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Buy / receive ─────────────────────────────────────────────────────────
  const [buyFrom, setBuyFrom] = useState<"supplier" | "customer" | "walk_in">("supplier");
  const [buyPartyId, setBuyPartyId] = useState("");
  const [buyPartyName, setBuyPartyName] = useState("");
  const [buyLines, setBuyLines] = useState<BuyLine[]>([emptyBuyLine()]);
  const [buyPaidNow, setBuyPaidNow] = useState("");
  const [buyPayInFull, setBuyPayInFull] = useState(true);
  const [buyNotes, setBuyNotes] = useState("");

  // ── Sell ──────────────────────────────────────────────────────────────────
  const [sellPartyId, setSellPartyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sellLines, setSellLines] = useState<SellLine[]>([emptySellLine()]);
  const [amountPaid, setAmountPaid] = useState("");
  const [sellOnDue, setSellOnDue] = useState(false);
  const [sellNotes, setSellNotes] = useState("");

  // ── Exchange ──────────────────────────────────────────────────────────────
  const [exPartyId, setExPartyId] = useState("");
  const [exPartyName, setExPartyName] = useState("");
  const [exPartyPhone, setExPartyPhone] = useState("");
  const [exInLines, setExInLines] = useState<BuyLine[]>([emptyBuyLine()]);
  const [exOutLines, setExOutLines] = useState<SellLine[]>([emptySellLine()]);
  const [exPaidNow, setExPaidNow] = useState("");
  const [exNotes, setExNotes] = useState("");

  const suppliers = useMemo(
    () => parties.filter((p) => p.party_type === "supplier"),
    [parties],
  );
  const customerParties = useMemo(
    () => parties.filter((p) => p.party_type === "customer"),
    [parties],
  );
  const selectedSellParty = useMemo(
    () => customerParties.find((p) => p.id === sellPartyId) || null,
    [customerParties, sellPartyId],
  );
  const selectedExParty = useMemo(
    () => customerParties.find((p) => p.id === exPartyId) || null,
    [customerParties, exPartyId],
  );
  const buyPartyList = buyFrom === "supplier" ? suppliers : customerParties;
  const selectedBuyParty = useMemo(
    () => buyPartyList.find((p) => p.id === buyPartyId) || null,
    [buyPartyList, buyPartyId],
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

  const refreshParties = async () => {
    try {
      const res = await fetch("/api/v1/admin/parties?limit=300");
      const json = await res.json();
      if (json.success) setParties(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const buyTotal = useMemo(
    () => buyLines.reduce((sum, l) => sum + buyLineTotal(l), 0),
    [buyLines],
  );
  const buyUnits = useMemo(
    () => buyLines.reduce((sum, l) => sum + buyLineUnits(l), 0),
    [buyLines],
  );
  const buyPaid = buyPayInFull ? buyTotal : Number(buyPaidNow) || 0;
  const buyOnAccount = Math.max(0, Math.round((buyTotal - buyPaid) * 100) / 100);

  const sellTotal = useMemo(
    () => sellLines.reduce((sum, l) => sum + sellLineTotal(l), 0),
    [sellLines],
  );
  const paidNow = sellOnDue ? Number(amountPaid) || 0 : sellTotal;
  const dueNow = Math.max(0, Math.round((sellTotal - paidNow) * 100) / 100);
  const headroom = selectedSellParty
    ? selectedSellParty.credit_limit - selectedSellParty.balance
    : 0;
  const overLimit = dueNow > 0 && selectedSellParty !== null && dueNow > headroom + 0.01;

  const exTradeIn = useMemo(
    () => exInLines.reduce((sum, l) => sum + buyLineTotal(l), 0),
    [exInLines],
  );
  const exGoodsOut = useMemo(
    () => exOutLines.reduce((sum, l) => sum + sellLineTotal(l), 0),
    [exOutLines],
  );
  const exNet = Math.round((exGoodsOut - exTradeIn) * 100) / 100;
  const exCollected = exNet > 0 ? Math.min(Number(exPaidNow) || 0, exNet) : 0;
  const exDue = exNet > 0 ? Math.round((exNet - exCollected) * 100) / 100 : 0;
  const exShopOwes = exNet < 0 ? Math.abs(exNet) : 0;
  const exHeadroom = selectedExParty
    ? selectedExParty.credit_limit - selectedExParty.balance
    : 0;
  const exOverLimit = exDue > 0 && selectedExParty !== null && exDue > exHeadroom + 0.01;

  // ── Submit: purchase / receive ────────────────────────────────────────────
  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      notify.warning("Choose the branch this stock is landing in.");
      return;
    }

    const partyName = selectedBuyParty?.name || buyPartyName;
    if (!partyName) {
      notify.warning("Say who these goods are coming from.");
      return;
    }
    if (buyOnAccount > 0 && !selectedBuyParty && buyFrom !== "supplier") {
      notify.warning(
        "Part of this purchase is unpaid, so it has to be owed to a registered party. Pick one, or pay in full.",
      );
      return;
    }

    const built = buildIntakeItems(buyLines);
    if ("error" in built) {
      notify.error(built.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/inventory/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "purchase",
          party_type: buyFrom,
          party_id: selectedBuyParty?.id || undefined,
          party_name: partyName,
          warehouse_id: warehouseId,
          amount_paid: buyPaid,
          notes: buyNotes,
          items: built.items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify.success(json.message);
        setBuyLines([emptyBuyLine()]);
        setBuyNotes("");
        setBuyPaidNow("");
        refreshParties();
      } else {
        notify.error(json.error || "Purchase failed");
      }
    } catch {
      notify.error("Error recording the purchase");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit: wholesale dispatch ────────────────────────────────────────────
  const handleBatchSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const partyName = selectedSellParty?.name || clientName;
    if (!partyName) {
      notify.warning("Pick a registered party, or type the client's name.");
      return;
    }
    if (!warehouseId) {
      notify.warning("Choose the branch the stock is leaving from.");
      return;
    }
    if (dueNow > 0 && !selectedSellParty) {
      notify.warning(
        "Selling on due needs a registered party — pick one, or add them under Customer Management first.",
      );
      return;
    }
    if (overLimit) {
      notify.warning(`That due is over ${selectedSellParty?.name}'s remaining credit of ${fmt(headroom)}.`);
      return;
    }

    const items = [];
    for (const [index, line] of sellLines.entries()) {
      const position = `Line ${index + 1}`;
      if (!line.product_id) {
        notify.warning(`${position}: choose a product.`);
        return;
      }
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      if (!Number.isInteger(quantity) || quantity < 1) {
        notify.warning(`${position}: quantity must be a whole number of 1 or more.`);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        notify.warning(`${position}: enter a unit price.`);
        return;
      }
      items.push({
        product_id: line.product_id,
        product_name: products.find((p) => p.id === line.product_id)?.name || "Wholesale item",
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
        notify.success(`Wholesale Order Created: ${json.message}`);
        setSellLines([emptySellLine()]);
        setClientName("");
        setClientPhone("");
        setSellPartyId("");
        setAmountPaid("");
        setSellOnDue(false);
        setSellNotes("");
        refreshParties();
      } else {
        notify.error(json.error || "Batch sell dispatch failed");
      }
    } catch {
      notify.error("Error submitting wholesale dispatch");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit: exchange ──────────────────────────────────────────────────────
  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const partyName = selectedExParty?.name || exPartyName;
    if (!partyName) {
      notify.warning("Say who is trading in.");
      return;
    }
    if (!warehouseId) {
      notify.warning("Choose the branch.");
      return;
    }
    if ((exDue > 0 || exShopOwes > 0) && !selectedExParty) {
      notify.warning(
        exDue > 0
          ? "The balance after the trade-in is unpaid, so it has to be owed by a registered party."
          : "The trade-in is worth more than the goods going out, so the difference has to be credited to a registered party.",
      );
      return;
    }
    if (exOverLimit) {
      notify.warning(`That balance is over ${selectedExParty?.name}'s remaining credit of ${fmt(exHeadroom)}.`);
      return;
    }

    const built = buildIntakeItems(exInLines);
    if ("error" in built) {
      notify.error(`Trade-in ${built.error.charAt(0).toLowerCase()}${built.error.slice(1)}`);
      return;
    }

    const sellItems = [];
    for (const [index, line] of exOutLines.entries()) {
      const position = `Outgoing line ${index + 1}`;
      if (!line.product_id) {
        notify.warning(`${position}: choose a product.`);
        return;
      }
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unit_price);
      if (!Number.isInteger(quantity) || quantity < 1) {
        notify.warning(`${position}: quantity must be a whole number of 1 or more.`);
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        notify.warning(`${position}: enter a unit price.`);
        return;
      }
      sellItems.push({
        product_id: line.product_id,
        product_name: products.find((p) => p.id === line.product_id)?.name || "Exchange item",
        quantity,
        unit_price: unitPrice,
      });
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/inventory/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "exchange",
          party_type: selectedExParty ? "customer" : "walk_in",
          party_id: selectedExParty?.id || undefined,
          party_name: partyName,
          party_phone: selectedExParty?.phone || exPartyPhone || undefined,
          warehouse_id: warehouseId,
          amount_paid: exCollected,
          notes: exNotes,
          items: built.items,
          sell_items: sellItems,
        }),
      });
      const json = await res.json();
      if (json.success) {
        notify.success(json.message);
        setExInLines([emptyBuyLine()]);
        setExOutLines([emptySellLine()]);
        setExPaidNow("");
        setExNotes("");
        setExPartyName("");
        setExPartyPhone("");
        setExPartyId("");
        refreshParties();
      } else {
        notify.error(json.error || "Exchange failed");
      }
    } catch {
      notify.error("Error recording the exchange");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabClass = (tab: typeof activeTab) =>
    `pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
      activeTab === tab
        ? "border-blue-600 text-blue-600 dark:text-blue-400"
        : "border-transparent text-zinc-500"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Procurement, Dispatch &amp; Exchange
          </h1>
          <p className="text-sm text-zinc-500">
            Buy from suppliers, parties and walk-in customers; dispatch wholesale on
            payment or on due; take devices in part-exchange.
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

      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button onClick={() => setActiveTab("buy")} className={tabClass("buy")}>
          📥 Buy / Receive Stock
        </button>
        <button onClick={() => setActiveTab("sell")} className={tabClass("sell")}>
          📤 Wholesale Dispatch
        </button>
        <button onClick={() => setActiveTab("exchange")} className={tabClass("exchange")}>
          🔄 Exchange / Trade-In
        </button>
        <button
          onClick={() => setActiveTab("purchase_list")}
          className={tabClass("purchase_list")}
        >
          📋 Purchase List
        </button>
        <button onClick={() => setActiveTab("sell_list")} className={tabClass("sell_list")}>
          🧾 Sell List
        </button>
      </div>

      {activeTab === "purchase_list" && <PurchaseListPanel warehouses={warehouses} />}
      {activeTab === "sell_list" && <SalesListPanel warehouses={warehouses} />}

      {/* ── BUY ──────────────────────────────────────────────────────────── */}
      {activeTab === "buy" && (
        <form
          onSubmit={handleBuySubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 max-w-5xl"
        >
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">
            Receive Stock
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className={LABEL}>Buying From *</label>
              <select
                value={buyFrom}
                onChange={(e) => {
                  setBuyFrom(e.target.value as typeof buyFrom);
                  setBuyPartyId("");
                }}
                className={FIELD}
              >
                <option value="supplier">Supplier</option>
                <option value="customer">Registered customer / party</option>
                <option value="walk_in">Walk-in (not registered)</option>
              </select>
            </div>

            {buyFrom !== "walk_in" && (
              <div>
                <label className={LABEL}>
                  {buyFrom === "supplier" ? "Registered Supplier" : "Registered Party"}
                </label>
                <select
                  value={buyPartyId}
                  onChange={(e) => setBuyPartyId(e.target.value)}
                  className={FIELD}
                >
                  <option value="">
                    {buyFrom === "supplier" ? "-- One-off / not registered --" : "-- Choose --"}
                  </option>
                  {buyPartyList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.balance > 0
                        ? ` — ${p.party_type === "supplier" ? "owed" : "owes"} ${fmt(p.balance)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={LABEL}>
                {selectedBuyParty ? "Name (from record)" : "Name *"}
              </label>
              <input
                type="text"
                value={selectedBuyParty?.name || buyPartyName}
                onChange={(e) => setBuyPartyName(e.target.value)}
                disabled={!!selectedBuyParty}
                placeholder="e.g. Star Tech Supply / Rahim Uddin"
                className={`${FIELD} disabled:opacity-60`}
              />
            </div>

            <div>
              <label className={LABEL}>Destination Branch *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={FIELD}
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

          <BuyLinesEditor
            lines={buyLines}
            setLines={setBuyLines}
            products={products}
            costLabel="Price Paid Per Unit"
          />

          {/* Settlement */}
          <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
            <label className="flex items-center gap-2 font-bold text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={buyPayInFull}
                onChange={(e) => {
                  setBuyPayInFull(e.target.checked);
                  if (e.target.checked) setBuyPaidNow("");
                }}
                className="h-4 w-4"
              />
              Paid in full now
            </label>

            {!buyPayInFull && (
              <>
                <div className="max-w-xs">
                  <label className={LABEL}>Paid Now (BDT)</label>
                  <input
                    type="number"
                    min={0}
                    value={buyPaidNow}
                    onChange={(e) => setBuyPaidNow(e.target.value)}
                    placeholder="0 to leave the whole bill on account"
                    className={FIELD}
                  />
                </div>
                <p className="font-bold text-zinc-500">
                  {buyFrom === "customer" && selectedBuyParty
                    ? `${fmt(buyOnAccount)} will be credited to ${selectedBuyParty.name} — set against the ${fmt(selectedBuyParty.balance)} they owe first, the rest held as credit.`
                    : `${fmt(buyOnAccount)} will be left owed to ${selectedBuyParty?.name || buyPartyName || "them"}.`}
                </p>
                {buyFrom === "walk_in" && buyOnAccount > 0 && (
                  <p className="font-bold text-amber-600">
                    A walk-in has no account to owe against. Pay in full, or register
                    them under Customer Management first.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="text-xs">
            <label className={LABEL}>Notes / Bill Ref</label>
            <input
              type="text"
              value={buyNotes}
              onChange={(e) => setBuyNotes(e.target.value)}
              placeholder="e.g. Invoice #DXB-994, or condition notes on a used device"
              className={FIELD}
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl space-y-1 text-xs font-bold">
            <div className="flex justify-between items-center">
              <span>
                {buyLines.length} line(s) · {buyUnits} unit(s) — Total:
              </span>
              <span className="text-blue-600 text-sm font-black">{fmt(buyTotal)}</span>
            </div>
            {buyOnAccount > 0 && (
              <div className="flex justify-between items-center text-amber-600">
                <span>Left on account:</span>
                <span>{fmt(buyOnAccount)}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (buyFrom === "walk_in" && buyOnAccount > 0)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Recording..." : "Receive Stock"}
          </button>
        </form>
      )}

      {/* ── SELL ─────────────────────────────────────────────────────────── */}
      {activeTab === "sell" && (
        <form
          onSubmit={handleBatchSellSubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 max-w-5xl"
        >
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">
            Corporate / Wholesale Dispatch
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className={LABEL}>Registered Party</label>
              <select
                value={sellPartyId}
                onChange={(e) => setSellPartyId(e.target.value)}
                className={FIELD}
              >
                <option value="">-- Not registered / walk-in --</option>
                {customerParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.customer_type === "wholesale" ? " (wholesale)" : ""}
                    {p.balance > 0 ? ` — owes ${fmt(p.balance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>
                {selectedSellParty ? "Party (from record)" : "Client Name *"}
              </label>
              <input
                type="text"
                value={selectedSellParty?.name || clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={!!selectedSellParty}
                placeholder="e.g. Brac Bank IT Procurement"
                className={`${FIELD} disabled:opacity-60`}
              />
            </div>
            <div>
              <label className={LABEL}>Dispatch From Branch *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={FIELD}
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
              <label className={LABEL}>Client Phone</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className={FIELD}
              />
            </div>
          )}

          <SellLinesEditor lines={sellLines} setLines={setSellLines} products={products} />

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
                  <label className={LABEL}>Paid Now (BDT)</label>
                  <input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0 for the whole order on due"
                    className={FIELD}
                  />
                </div>

                {selectedSellParty ? (
                  <p className={`font-bold ${overLimit ? "text-rose-600" : "text-zinc-500"}`}>
                    {selectedSellParty.name} owes {fmt(selectedSellParty.balance)} of a{" "}
                    {fmt(selectedSellParty.credit_limit)} limit — {fmt(headroom)} of credit
                    left.
                    {overLimit && ` This due of ${fmt(dueNow)} is over that.`}
                  </p>
                ) : (
                  <p className="font-bold text-amber-600">
                    Pick a registered party above. A due has to be owed by someone the shop
                    can look up.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="text-xs">
            <label className={LABEL}>Dispatch Notes</label>
            <input
              type="text"
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              placeholder="e.g. PO #4471, deliver to Gulshan office"
              className={FIELD}
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

      {/* ── EXCHANGE ─────────────────────────────────────────────────────── */}
      {activeTab === "exchange" && (
        <form
          onSubmit={handleExchangeSubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 max-w-5xl"
        >
          <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">
              Part-Exchange
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              The customer&rsquo;s device is valued and set against what they are buying.
              Only the difference changes hands.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className={LABEL}>Registered Party</label>
              <select
                value={exPartyId}
                onChange={(e) => setExPartyId(e.target.value)}
                className={FIELD}
              >
                <option value="">-- Walk-in (not registered) --</option>
                {customerParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.balance > 0 ? ` — owes ${fmt(p.balance)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>
                {selectedExParty ? "Customer (from record)" : "Customer Name *"}
              </label>
              <input
                type="text"
                value={selectedExParty?.name || exPartyName}
                onChange={(e) => setExPartyName(e.target.value)}
                disabled={!!selectedExParty}
                placeholder="e.g. Rahim Uddin"
                className={`${FIELD} disabled:opacity-60`}
              />
            </div>
            {!selectedExParty && (
              <div>
                <label className={LABEL}>Phone</label>
                <input
                  type="text"
                  value={exPartyPhone}
                  onChange={(e) => setExPartyPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className={FIELD}
                />
              </div>
            )}
            <div>
              <label className={LABEL}>Branch *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={FIELD}
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

          <div className="space-y-3">
            <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider">
              Taken in — the customer&rsquo;s device(s)
            </h3>
            <BuyLinesEditor
              lines={exInLines}
              setLines={setExInLines}
              products={products}
              costLabel="Trade-In Value Per Unit"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-emerald-600 uppercase tracking-wider">
              Going out — what they are buying
            </h3>
            <SellLinesEditor
              lines={exOutLines}
              setLines={setExOutLines}
              products={products}
            />
          </div>

          {exNet > 0 && (
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
              <div className="max-w-xs">
                <label className={LABEL}>Collected Now (BDT)</label>
                <input
                  type="number"
                  min={0}
                  max={exNet}
                  value={exPaidNow}
                  onChange={(e) => setExPaidNow(e.target.value)}
                  placeholder={`Up to ${fmt(exNet)}`}
                  className={FIELD}
                />
              </div>
              {exDue > 0 &&
                (selectedExParty ? (
                  <p className={`font-bold ${exOverLimit ? "text-rose-600" : "text-zinc-500"}`}>
                    {fmt(exDue)} will be left on {selectedExParty.name}&rsquo;s account —{" "}
                    {fmt(exHeadroom)} of credit available.
                    {exOverLimit && " That is over their limit."}
                  </p>
                ) : (
                  <p className="font-bold text-amber-600">
                    {fmt(exDue)} would be left unpaid. Pick a registered party, or collect
                    the full {fmt(exNet)}.
                  </p>
                ))}
            </div>
          )}

          {exShopOwes > 0 && (
            <p className="text-xs font-bold text-amber-600 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
              The trade-in is worth {fmt(exShopOwes)} more than the goods going out. That
              difference is credited to the customer&rsquo;s account — clearing anything
              they owe first — so it needs a registered party.
            </p>
          )}

          <div className="text-xs">
            <label className={LABEL}>Exchange Notes</label>
            <input
              type="text"
              value={exNotes}
              onChange={(e) => setExNotes(e.target.value)}
              placeholder="e.g. Screen has a hairline crack, box and charger included"
              className={FIELD}
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl space-y-1 text-xs font-bold">
            <div className="flex justify-between items-center text-emerald-600">
              <span>Goods going out:</span>
              <span>{fmt(exGoodsOut)}</span>
            </div>
            <div className="flex justify-between items-center text-amber-600">
              <span>Trade-in allowance:</span>
              <span>− {fmt(exTradeIn)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-zinc-300 dark:border-zinc-700">
              <span>{exNet >= 0 ? "Customer pays:" : "Shop owes customer:"}</span>
              <span className="text-blue-600 text-sm font-black">
                {fmt(Math.abs(exNet))}
              </span>
            </div>
            {exDue > 0 && (
              <div className="flex justify-between items-center text-rose-600">
                <span>Of which on due:</span>
                <span>{fmt(exDue)}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || exOverLimit}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Recording..." : "Record Exchange"}
          </button>
        </form>
      )}
    </div>
  );
}
