"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBDT } from "@/lib/currency";
import { SearchableSelect } from "@/components/ui";

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  base_price: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export interface PartyOption {
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
export interface BuyLine {
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
export interface SellLine {
  key: string;
  product_id: string;
  quantity: string;
  unit_price: string;
}

export const fmt = (n: number) => formatBDT(n);

export const newKey = () => Math.random().toString(36).slice(2, 9);

export const emptyBuyLine = (): BuyLine => ({
  key: newKey(),
  product_id: "",
  mode: "serialized",
  unit_cost: "",
  selling_price: "",
  warranty_months: "12",
  serials_text: "",
  quantity: "1",
});

export const emptySellLine = (): SellLine => ({
  key: newKey(),
  product_id: "",
  quantity: "1",
  unit_price: "",
});

/** Units on a serialized line: one per non-empty row of the textarea. */
export function parseSerials(text: string) {
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

export function buyLineUnits(line: BuyLine): number {
  return line.mode === "serialized"
    ? parseSerials(line.serials_text).length
    : Number(line.quantity) || 0;
}

export const buyLineTotal = (line: BuyLine) => (Number(line.unit_cost) || 0) * buyLineUnits(line);
export const sellLineTotal = (line: SellLine) =>
  (Number(line.unit_price) || 0) * (Number(line.quantity) || 0);

/** Catalogue rows as combobox options — name searches, SKU searches too. */
export function productOptions(products: ProductOption[]) {
  return products.map((p) => ({
    value: p.id,
    label: p.name,
    hint: `${p.sku ? `SKU ${p.sku} · ` : ""}${fmt(p.base_price)}`,
    keywords: p.sku ?? "",
  }));
}

export const FIELD =
  "w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-zinc-900 dark:text-white";
export const LABEL = "block font-bold text-zinc-700 dark:text-zinc-300 mb-1";

/** Goods-in line editor, shared by the buy and exchange screens. */
export function BuyLinesEditor({
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

  const options = useMemo(() => productOptions(products), [products]);

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
              <SearchableSelect
                options={options}
                value={line.product_id}
                onChange={(productId) => {
                  const product = products.find((p) => p.id === productId);
                  update(line.key, {
                    product_id: productId,
                    unit_cost: product
                      ? String(Math.round(product.base_price * 0.85))
                      : line.unit_cost,
                    selling_price: product
                      ? String(Math.round(product.base_price))
                      : line.selling_price,
                  });
                }}
                emptyLabel="-- Choose Product --"
                placeholder="Type a product name or SKU…"
                aria-label={`Catalog product, line ${index + 1}`}
              />
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
export function SellLinesEditor({
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

  const options = useMemo(() => productOptions(products), [products]);

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
              <SearchableSelect
                options={options}
                value={line.product_id}
                onChange={(productId) => {
                  const product = products.find((p) => p.id === productId);
                  update(line.key, {
                    product_id: productId,
                    unit_price: product ? String(product.base_price) : line.unit_price,
                  });
                }}
                emptyLabel="-- Choose Product --"
                placeholder="Type a product name or SKU…"
                aria-label={`Product, line ${index + 1}`}
              />
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
export function buildIntakeItems(
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


/**
 * Just the branches. The two history screens filter by branch and need nothing
 * else — loading the catalogue and every party for them was three requests
 * where one does.
 */
export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/admin/warehouses");
        const json = await res.json();
        if (!cancelled && json.success) setWarehouses(json.data || []);
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return warehouses;
}

/**
 * Everything the procurement forms need before they can show anything: the
 * catalogue, the branches, and the parties on both sides of the ledger.
 *
 * Each screen is its own page now, so each one loads this for itself. It is
 * three small reads and they go out together.
 */
export function useProcurementData() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshParties = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/parties?limit=300");
      const json = await res.json();
      if (json.success) setParties(json.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

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
        if (cancelled) return;

        if (prodJson.success) setProducts(prodJson.data || []);
        if (whJson.success && whJson.data?.length > 0) {
          setWarehouses(whJson.data);
          setWarehouseId(whJson.data[0].id);
        }
        if (partyJson.success) setParties(partyJson.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    products,
    warehouses,
    parties,
    warehouseId,
    setWarehouseId,
    refreshParties,
    loading,
  };
}
