"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BranchTransfer {
  id: string;
  transfer_number: string;
  source_warehouse_id: string;
  target_warehouse_id: string;
  status: "pending" | "in_transit" | "received" | "rejected";
  total_items: number;
  notes: string | null;
  created_at: string;
  source?: { id: string; name: string; code: string };
  target?: { id: string; name: string; code: string };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface AvailableUnit {
  id: string;
  serial_number: string;
  products: { id: string; name: string };
}

export default function BranchTransfersPage() {
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // New Transfer Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [availableUnits, setAvailableUnits] = useState<AvailableUnit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [transferNotes, setTransferNotes] = useState("");

  useEffect(() => {
    fetchTransfers();
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const res = await fetch("/api/v1/admin/warehouses");
      const json = await res.json();
      if (json.success && json.data) {
        setWarehouses(json.data);
        if (json.data.length >= 2) {
          setSourceBranch(json.data[0].id);
          setTargetBranch(json.data[1].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/inventory/transfers");
      const json = await res.json();
      if (json.success) setTransfers(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available units in source branch
  useEffect(() => {
    if (!sourceBranch) return;
    async function loadUnits() {
      try {
        const res = await fetch(`/api/v1/admin/inventory/serialized?warehouse_id=${sourceBranch}&status=in_stock`);
        const json = await res.json();
        if (json.success) setAvailableUnits(json.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadUnits();
  }, [sourceBranch]);

  const handleCreateTransfer = async () => {
    if (!sourceBranch || !targetBranch || sourceBranch === targetBranch) {
      alert("Source and destination branch must be different!");
      return;
    }
    if (selectedUnits.length === 0) {
      alert("Select at least 1 device unit to transfer.");
      return;
    }

    try {
      const payload = {
        action: "create_transfer",
        source_warehouse_id: sourceBranch,
        target_warehouse_id: targetBranch,
        items: selectedUnits.map(uid => {
          const unit = availableUnits.find(u => u.id === uid);
          return {
            product_id: unit?.products?.id,
            device_unit_id: uid,
            quantity: 1
          };
        }),
        notes: transferNotes
      };

      const res = await fetch("/api/v1/admin/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setShowNewModal(false);
        setSelectedUnits([]);
        setTransferNotes("");
        fetchTransfers();
      } else {
        alert(json.error || "Failed to create transfer");
      }
    } catch (err) {
      alert("Failed to submit transfer");
    }
  };

  const handleUpdateStatus = async (transferId: string, status: "in_transit" | "received" | "rejected") => {
    try {
      const res = await fetch("/api/v1/admin/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", transfer_id: transferId, status })
      });
      const json = await res.json();
      if (json.success) {
        fetchTransfers();
      } else {
        alert(json.error || "Failed to update status");
      }
    } catch (err) {
      alert("Error updating transfer status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Inter-Branch Stock Movement</h1>
          <p className="text-sm text-zinc-500">Manage device transfers across branches with end-to-end status tracking.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/inventory/serialized" className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300">
            ← Serialized Database
          </Link>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
          >
            <span>🚚</span> Create Inter-Branch Transfer
          </button>
        </div>
      </div>

      {/* Transfers List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading branch transfers...</div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <span className="text-3xl">📦</span>
            <p className="font-bold text-sm mt-2">No Inter-Branch Transfers</p>
            <p className="text-xs text-zinc-500 mt-1">Initiate a transfer to dispatch stock between stores.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Transfer #</th>
                  <th className="px-4 py-3.5">From Branch</th>
                  <th className="px-4 py-3.5">To Branch</th>
                  <th className="px-4 py-3.5">Items Count</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created At</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {transfers.map(trf => (
                  <tr key={trf.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {trf.transfer_number}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {trf.source?.name || "Source"}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {trf.target?.name || "Target"}
                    </td>
                    <td className="px-4 py-3 font-bold">{trf.total_items} Devices</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                        trf.status === "received"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : trf.status === "in_transit"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : trf.status === "rejected"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {trf.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(trf.created_at).toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      {trf.status === "pending" && (
                        <button
                          onClick={() => handleUpdateStatus(trf.id, "in_transit")}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold"
                        >
                          Mark In-Transit
                        </button>
                      )}
                      {trf.status === "in_transit" && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(trf.id, "received")}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                          >
                            Receive at Branch
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(trf.id, "rejected")}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- CREATE TRANSFER MODAL --- */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">Initiate Inter-Branch Transfer</h2>
              <button onClick={() => setShowNewModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Source Branch (From)</label>
                <select
                  value={sourceBranch}
                  onChange={e => setSourceBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Target Branch (To)</label>
                <select
                  value={targetBranch}
                  onChange={e => setTargetBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Devices */}
            <div className="text-xs">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Select Serialized Devices in Source Branch ({availableUnits.length} available)
              </label>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-1.5">
                {availableUnits.length === 0 ? (
                  <p className="text-zinc-400 text-center py-4">No in-stock units available at source branch.</p>
                ) : (
                  availableUnits.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                        selectedUnits.includes(u.id) ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40" : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnits.includes(u.id)}
                        onChange={() => {
                          setSelectedUnits(prev =>
                            prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]
                          );
                        }}
                        className="accent-blue-600"
                      />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-white">{u.products?.name}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 ml-2">SN: {u.serial_number}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Transfer Manifest Notes</label>
              <input
                type="text"
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="e.g. Courier dispatch via Sundarban or internal courier"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTransfer}
                disabled={selectedUnits.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 disabled:opacity-40"
              >
                Dispatch Transfer ({selectedUnits.length} Units)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
