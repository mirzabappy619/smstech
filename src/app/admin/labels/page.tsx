"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DeviceUnit {
  id: string;
  serial_number: string;
  imei_1: string | null;
  battery_health_pct: number | null;
  cosmetic_grade: string;
  selling_price: number;
  products: {
    name: string;
    brand: string;
    sku: string;
  };
}

const fmt = (n: number) => "৳" + (Number(n) || 0).toLocaleString("en-BD");

export default function LabelGeneratorPage() {
  const [deviceUnits, setDeviceUnits] = useState<DeviceUnit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [labelType, setLabelType] = useState<"device_tag" | "shelf_tag" | "warranty_seal">("device_tag");
  const [barcodeType, setBarcodeType] = useState<"qr" | "barcode">("qr");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUnits() {
      try {
        const res = await fetch("/api/v1/admin/inventory/serialized");
        const json = await res.json();
        if (json.success) {
          setDeviceUnits(json.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadUnits();
  }, []);

  const toggleSelectAll = () => {
    if (selectedUnits.length === deviceUnits.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(deviceUnits.map(u => u.id));
    }
  };

  const toggleUnit = (id: string) => {
    setSelectedUnits(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  const selectedData = deviceUnits.filter(u => selectedUnits.includes(u.id));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">QR & Barcode Label Sticker Generator</h1>
          <p className="text-sm text-zinc-500">Generate 2D QR stickers, serialized unit tags, shelf price tags, and warranty seals.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/pos" className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300">
            ← Back to POS
          </Link>
          <button
            onClick={() => window.print()}
            disabled={selectedData.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all disabled:opacity-40 flex items-center gap-2"
          >
            <span>🖨️</span> Print Selected Stickers ({selectedData.length})
          </button>
        </div>
      </div>

      {/* Configuration & Selection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 print:hidden">
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Sticker Template</label>
          <select
            value={labelType}
            onChange={e => setLabelType(e.target.value as any)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
          >
            <option value="device_tag">📱 Pre-Owned Device Sticker (Serial + Battery + Grade)</option>
            <option value="shelf_tag">🏷️ Shelf Price Tag (Large Name + Price + SKU)</option>
            <option value="warranty_seal">🔒 Tamper-Proof Warranty Seal</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">Code Format</label>
          <select
            value={barcodeType}
            onChange={e => setBarcodeType(e.target.value as any)}
            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
          >
            <option value="qr">2D QR Code Matrix</option>
            <option value="barcode">1D Code 128 Barcode</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={toggleSelectAll}
            className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors"
          >
            {selectedUnits.length === deviceUnits.length ? "Deselect All" : "Select All Units"}
          </button>
        </div>
      </div>

      {/* Unit Selector Checkbox Grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 print:hidden">
        <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white mb-3">Select Units for Label Printing</h2>
        {loading ? (
          <div className="text-xs text-zinc-400 py-6 text-center">Loading device inventory...</div>
        ) : deviceUnits.length === 0 ? (
          <div className="text-xs text-zinc-400 py-6 text-center">No device units found in inventory.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
            {deviceUnits.map(unit => (
              <label
                key={unit.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedUnits.includes(unit.id)
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedUnits.includes(unit.id)}
                  onChange={() => toggleUnit(unit.id)}
                  className="mt-1 accent-blue-600 rounded"
                />
                <div className="min-w-0">
                  <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">{unit.products?.name}</p>
                  <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400">SN: {unit.serial_number}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {unit.cosmetic_grade} · 🔋{unit.battery_health_pct}% · {fmt(unit.selling_price)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Printable Sheet Area */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 print:border-0 print:p-0">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 print:hidden">Live Label Sheet Preview</h2>
        
        {selectedData.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-xs font-semibold">
            Select items above to generate printable stickers.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-3 print:gap-2">
            {selectedData.map(unit => (
              <div
                key={unit.id}
                className="border-2 border-black p-3 rounded-xl bg-white text-black font-mono flex flex-col items-center justify-between text-center relative overflow-hidden"
                style={{ width: "200px", height: "130px" }}
              >
                <div className="w-full text-left border-b border-black pb-1">
                  <p className="text-[10px] font-extrabold uppercase truncate">{unit.products?.name}</p>
                  <div className="flex justify-between text-[8px] font-bold">
                    <span>{unit.products?.brand}</span>
                    <span className="text-black">{fmt(unit.selling_price)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full my-1">
                  {/* Generated QR / Barcode SVG */}
                  <div className="w-12 h-12 border border-black flex items-center justify-center p-1">
                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v4h-4v-4zm-4 4h4v4h-4v-4zm4-4h4v-4h-4v4zm-4-4h4v4h-4v-4z" />
                    </svg>
                  </div>

                  <div className="text-left text-[8px] space-y-0.5 leading-tight">
                    <div><b>SN:</b> {unit.serial_number}</div>
                    {unit.imei_1 && <div><b>IMEI:</b> {unit.imei_1}</div>}
                    <div><b>GRADE:</b> {unit.cosmetic_grade}</div>
                    {unit.battery_health_pct && <div><b>BATTERY:</b> {unit.battery_health_pct}%</div>}
                  </div>
                </div>

                <div className="w-full text-[7px] border-t border-black pt-0.5 flex justify-between font-bold">
                  <span>SMSTECH CERTIFIED</span>
                  <span>WARRANTY SEAL</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
