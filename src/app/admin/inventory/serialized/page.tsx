"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SerializedUnit {
  id: string;
  serial_number: string;
  imei_1: string | null;
  imei_2: string | null;
  mac_address: string | null;
  battery_health_pct: number | null;
  battery_cycles: number;
  cosmetic_grade: string;
  regional_variant: string;
  cost_price: number;
  selling_price: number;
  status: "in_stock" | "reserved" | "sold" | "in_transit" | "defective";
  warehouse_id: string;
  created_at: string;
  products: {
    id: string;
    name: string;
    sku: string;
    brand: string;
  };
  warehouses: {
    id: string;
    name: string;
    code: string;
  };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  base_price: number;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

const fmt = (n: number) => "৳" + (Number(n) || 0).toLocaleString("en-BD");

export default function SerializedInventoryPage() {
  const [units, setUnits] = useState<SerializedUnit[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Unit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formProductId, setFormProductId] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formImei1, setFormImei1] = useState("");
  const [formImei2, setFormImei2] = useState("");
  const [formMac, setFormMac] = useState("");
  const [formBatteryHealth, setFormBatteryHealth] = useState("95");
  const [formBatteryCycles, setFormBatteryCycles] = useState("45");
  const [formGrade, setFormGrade] = useState("Like New A+");
  const [formVariant, setFormVariant] = useState("Official");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [warehouseFilter, statusFilter, gradeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (warehouseFilter !== "all") params.append("warehouse_id", warehouseFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (gradeFilter !== "all") params.append("grade", gradeFilter);
      if (searchQuery) params.append("q", searchQuery);

      const [unitRes, prodRes, whRes] = await Promise.all([
        fetch(`/api/v1/admin/inventory/serialized?${params}`),
        fetch("/api/v1/products?show_all=true&limit=100"),
        fetch("/api/v1/admin/warehouses")
      ]);

      const [unitData, prodData, whData] = await Promise.all([
        unitRes.json(),
        prodRes.json(),
        whRes.json()
      ]);

      if (unitData.success) setUnits(unitData.data || []);
      if (prodData.success) setProducts(prodData.data || []);
      if (whData.success) {
        setWarehouses(whData.data || []);
        if (whData.data?.length > 0 && !formWarehouseId) {
          setFormWarehouseId(whData.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId || !formWarehouseId || !formSerial || !formSellingPrice) {
      alert("Please fill in Product, Branch, Serial Number, and Selling Price.");
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/inventory/serialized", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: formProductId,
          warehouse_id: formWarehouseId,
          serial_number: formSerial,
          imei_1: formImei1,
          imei_2: formImei2,
          mac_address: formMac,
          battery_health_pct: formBatteryHealth,
          battery_cycles: formBatteryCycles,
          cosmetic_grade: formGrade,
          regional_variant: formVariant,
          cost_price: formCostPrice,
          selling_price: formSellingPrice,
          notes: formNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setFormSerial("");
        setFormImei1("");
        fetchData();
      } else {
        alert(json.error || "Failed to create unit");
      }
    } catch (err) {
      alert("Error adding unit");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Serialized Hardware & Pre-Owned Database
          </h1>
          <p className="text-sm text-zinc-500">
            Track physical device serials, IMEI 1/2, MAC IDs, battery health %, cycle counts, and cosmetic grades across branches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/inventory/transfers"
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all"
          >
            🚚 Branch Transfers
          </Link>
          <Link
            href="/admin/inventory/procurement"
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all"
          >
            📦 Batch Buy / Sell
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
          >
            <span>+</span> Register Device Unit
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Total Tracked Units</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{units.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">In Stock Ready</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {units.filter(u => u.status === "in_stock").length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Units Sold</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {units.filter(u => u.status === "sold").length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Avg Battery Health</p>
          <p className="text-2xl font-black text-amber-500 mt-1">
            {units.filter(u => u.battery_health_pct).length > 0
              ? Math.round(
                  units
                    .filter(u => u.battery_health_pct)
                    .reduce((s, u) => s + (u.battery_health_pct || 0), 0) /
                    units.filter(u => u.battery_health_pct).length
                ) + "%"
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchData()}
          placeholder="Search Serial, IMEI, or SKU..."
          className="flex-1 min-w-[200px] px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white"
        />

        <select
          value={warehouseFilter}
          onChange={e => setWarehouseFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
        >
          <option value="all">All Branches</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
          <option value="in_transit">In-Transit</option>
          <option value="defective">Defective</option>
        </select>

        <select
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
        >
          <option value="all">All Grades</option>
          <option value="Brand New">Brand New</option>
          <option value="Like New A+">Like New A+</option>
          <option value="Grade A">Grade A</option>
          <option value="Grade B">Grade B</option>
        </select>

        <button
          onClick={fetchData}
          className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold"
        >
          Filter
        </button>
      </div>

      {/* Serialized Units Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading serialized hardware inventory...</div>
        ) : units.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm mt-2">No Serialized Units Found</p>
            <p className="text-xs text-zinc-500 mt-1">Register a device unit or adjust filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Device / Product</th>
                  <th className="px-4 py-3.5">Serial / IMEI / MAC</th>
                  <th className="px-4 py-3.5">Condition & Battery</th>
                  <th className="px-4 py-3.5">Variant</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Selling Price</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {units.map(unit => (
                  <tr key={unit.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-extrabold text-zinc-900 dark:text-white">{unit.products?.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">SKU: {unit.products?.sku} · {unit.products?.brand}</p>
                    </td>

                    <td className="px-4 py-3 font-mono space-y-0.5">
                      <div className="font-bold text-blue-600 dark:text-blue-400">SN: {unit.serial_number}</div>
                      {unit.imei_1 && <div className="text-[10px] text-zinc-500">IMEI 1: {unit.imei_1}</div>}
                      {unit.imei_2 && <div className="text-[10px] text-zinc-400">IMEI 2: {unit.imei_2}</div>}
                      {unit.mac_address && <div className="text-[10px] text-zinc-400">MAC: {unit.mac_address}</div>}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          unit.cosmetic_grade === "Brand New"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}>
                          {unit.cosmetic_grade}
                        </span>
                      </div>
                      {unit.battery_health_pct !== null && (
                        <div className="text-[10px] text-zinc-500 mt-1 font-semibold flex items-center gap-1">
                          <span>🔋 {unit.battery_health_pct}%</span>
                          <span>· {unit.battery_cycles} cycles</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{unit.regional_variant}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white">{unit.warehouses?.name}</span>
                      <p className="text-[10px] text-zinc-400 font-mono">{unit.warehouses?.code}</p>
                    </td>

                    <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-white">
                      {fmt(unit.selling_price)}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        unit.status === "in_stock"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : unit.status === "sold"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : unit.status === "in_transit"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {unit.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD UNIT MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">Register Serialized Device Unit</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateUnit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select Catalog Product *</label>
                <select
                  value={formProductId}
                  onChange={e => {
                    setFormProductId(e.target.value);
                    const sel = products.find(p => p.id === e.target.value);
                    if (sel) setFormSellingPrice(String(sel.base_price));
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
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Branch / Warehouse Location *</label>
                <select
                  value={formWarehouseId}
                  onChange={e => setFormWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  required
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Serial Number *</label>
                  <input
                    type="text"
                    value={formSerial}
                    onChange={e => setFormSerial(e.target.value)}
                    placeholder="e.g. C02G998ZMD6R"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono uppercase font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">IMEI 1 (Optional)</label>
                  <input
                    type="text"
                    value={formImei1}
                    onChange={e => setFormImei1(e.target.value)}
                    placeholder="358992019283741"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">IMEI 2 (Optional)</label>
                  <input
                    type="text"
                    value={formImei2}
                    onChange={e => setFormImei2(e.target.value)}
                    placeholder="358992019283742"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">MAC Address (Optional)</label>
                  <input
                    type="text"
                    value={formMac}
                    onChange={e => setFormMac(e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Cosmetic Grade</label>
                  <select
                    value={formGrade}
                    onChange={e => setFormGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  >
                    <option value="Brand New">Brand New</option>
                    <option value="Like New A+">Like New A+</option>
                    <option value="Grade A">Grade A</option>
                    <option value="Grade B">Grade B</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Regional Variant</label>
                  <select
                    value={formVariant}
                    onChange={e => setFormVariant(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  >
                    <option value="Official">Official BTRC</option>
                    <option value="US">US Variant (LL/A)</option>
                    <option value="JP">Japan Variant (J/A)</option>
                    <option value="ZA">Singapore/HK (ZA/A)</option>
                    <option value="Global">Global Unofficial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Battery Health %</label>
                  <input
                    type="number"
                    value={formBatteryHealth}
                    onChange={e => setFormBatteryHealth(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Battery Cycle Count</label>
                  <input
                    type="number"
                    value={formBatteryCycles}
                    onChange={e => setFormBatteryCycles(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Cost Price (BDT)</label>
                  <input
                    type="number"
                    value={formCostPrice}
                    onChange={e => setFormCostPrice(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Selling Price (BDT) *</label>
                  <input
                    type="number"
                    value={formSellingPrice}
                    onChange={e => setFormSellingPrice(e.target.value)}
                    placeholder="e.g. 58000"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-blue-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Unit Inspection Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Minor hairline scratch on bezel, 100% original display"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30"
                >
                  Save Device Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
