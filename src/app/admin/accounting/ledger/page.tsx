"use client";

import { useState, useEffect } from "react";
import { formatBDT } from "@/lib/currency";
import { notify } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui";


interface LedgerEntry {
  id: string;
  party_type: "customer" | "supplier";
  party_id: string;
  party_name: string;
  entry_type: "debit" | "credit";
  amount: number;
  balance_after: number;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

interface CustomerWithDue {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  outstanding_due: number;
  advance_balance: number;
  loyalty_tier: string;
}

const fmt = (n: number) => formatBDT(n);

export default function AccountingLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [customers, setCustomers] = useState<CustomerWithDue[]>([]);
  const [partyTypeFilter, setPartyTypeFilter] = useState("all");
  const [summary, setSummary] = useState({
    totalDuesReceivable: 0,
    totalAdvanceLiabilities: 0,
    totalSupplierPayables: 0,
  });
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Due Collection Modal
  const [showDueModal, setShowDueModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [collectionRef, setCollectionRef] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [receiptResult, setReceiptResult] = useState<any | null>(null);

  useEffect(() => {
    fetchLedger();
    fetchCustomersWithDue();
  }, [partyTypeFilter]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/accounting/ledger?party_type=${partyTypeFilter}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data || []);
        if (json.summary) setSummary(json.summary);
        setLedgerTotal(json.meta?.total ?? (json.data || []).length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersWithDue = async () => {
    try {
      const res = await fetch("/api/v1/admin/customers?limit=100");
      const json = await res.json();
      if (json.success && json.data) {
        setCustomers(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustId || !collectionAmount) {
      notify.warning("Please select customer and amount.");
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/accounting/due-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustId,
          amount: collectionAmount,
          payment_method: paymentMethod,
          reference: collectionRef,
          notes: collectionNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setReceiptResult(json.data);
        setShowDueModal(false);
        setCollectionAmount("");
        fetchLedger();
        fetchCustomersWithDue();
      } else {
        notify.error(json.error || "Collection failed");
      }
    } catch (err) {
      notify.error("Error collecting due");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Party Accounting Ledger & Dues</h1>
          <p className="text-sm text-zinc-500">Double-entry audit ledger tracking debits, credits, customer dues, and supplier settlements.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDueModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
          >
            <span>💰</span> Receive Due Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Total Customer Dues Receivable</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{fmt(summary.totalDuesReceivable)}</p>
          <p className="text-[10px] text-zinc-400 mt-1">Outstanding amounts across all customers</p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Customer Advance Deposit Liabilities</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{fmt(summary.totalAdvanceLiabilities)}</p>
          <p className="text-[10px] text-zinc-400 mt-1">Customer store credit & pre-booking wallet balances</p>
        </div>

        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <p className="text-xs font-medium text-zinc-500">Supplier Payables</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{fmt(summary.totalSupplierPayables)}</p>
          <p className="text-[10px] text-zinc-400 mt-1">
            {ledgerTotal} journal row{ledgerTotal === 1 ? "" : "s"} recorded
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setPartyTypeFilter("all")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            partyTypeFilter === "all" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-black" : "border-transparent text-zinc-500"
          }`}
        >
          All Ledger Entries
        </button>
        <button
          onClick={() => setPartyTypeFilter("customer")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            partyTypeFilter === "customer" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-black" : "border-transparent text-zinc-500"
          }`}
        >
          Customer Ledgers
        </button>
        <button
          onClick={() => setPartyTypeFilter("supplier")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            partyTypeFilter === "supplier" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-black" : "border-transparent text-zinc-500"
          }`}
        >
          Supplier Bills
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading ledger records...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <span className="text-3xl">📑</span>
            <p className="font-bold text-sm mt-2">No Ledger Records Found</p>
            <p className="text-xs text-zinc-500 mt-1">Transactions, sales invoices, and bills will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3.5">Date / Time</th>
                  <th className="px-4 py-3.5">Party Name</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Reference / Memo</th>
                  <th className="px-4 py-3.5">Debit (In)</th>
                  <th className="px-4 py-3.5">Credit (Out)</th>
                  <th className="px-4 py-3.5">Running Balance</th>
                  <th className="px-4 py-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                {(entries || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No ledger transactions found
                    </td>
                  </tr>
                ) : (
                  (entries || []).map(entry => (
                    <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500 font-mono">
                      {new Date(entry.created_at).toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-zinc-900 dark:text-white">{entry.party_name}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize">
                        {entry.party_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold capitalize text-zinc-700 dark:text-zinc-300">
                      {entry.reference_type.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {entry.reference_id || "—"}
                    </td>
                    <td className="px-4 py-3 font-black text-rose-600">
                      {entry.entry_type === "debit" ? fmt(entry.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-600">
                      {entry.entry_type === "credit" ? fmt(entry.amount) : "—"}
                    </td>
                    <td className="px-4 py-3 font-black text-zinc-900 dark:text-white">
                      {fmt(entry.balance_after)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                      {entry.notes || "—"}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- DUE COLLECTION MODAL --- */}
      {showDueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">Receive Due Settlement Payment</h2>
              <button onClick={() => setShowDueModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCollectDue} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select Customer *</label>
                <SearchableSelect
                  options={customers.map(c => ({
                    value: c.id,
                    label: c.name,
                    hint: `${c.phone ? `${c.phone} · ` : ""}Outstanding due: ${fmt(c.outstanding_due || 0)}`,
                    keywords: c.phone ?? "",
                  }))}
                  value={selectedCustId}
                  onChange={(customerId) => {
                    setSelectedCustId(customerId);
                    const c = customers.find(x => x.id === customerId);
                    if (c && c.outstanding_due > 0) setCollectionAmount(String(c.outstanding_due));
                  }}
                  emptyLabel="-- Choose Customer --"
                  placeholder="Type a name or phone number…"
                  aria-label="Customer"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Amount Collected (BDT) *</label>
                <input
                  type="number"
                  value={collectionAmount}
                  onChange={e => setCollectionAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold text-emerald-600 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Payment Channel</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                  >
                    <option value="cash">Cash In Hand</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Bank Card / POS</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Transaction Ref (Optional)</label>
                  <input
                    type="text"
                    value={collectionRef}
                    onChange={e => setCollectionRef(e.target.value)}
                    placeholder="TrxID / Memo #"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={collectionNotes}
                  onChange={e => setCollectionNotes(e.target.value)}
                  placeholder="e.g. Cleared remaining balance on invoice POS-881"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDueModal(false)}
                  className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg shadow-emerald-600/30"
                >
                  Record Payment & Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DUE RECEIPT RESULT POPUP --- */}
      {receiptResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <span className="text-5xl">🧾</span>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">Due Settlement Receipt</h2>
            <p className="text-xs text-zinc-500 font-mono">Receipt #{receiptResult.receiptNumber}</p>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs space-y-1.5 text-left">
              <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{receiptResult.customerName}</span></div>
              <div className="flex justify-between"><span>Amount Paid:</span><span className="font-bold text-emerald-600">{fmt(receiptResult.amountCollected)}</span></div>
              <div className="flex justify-between"><span>Previous Due:</span><span>{fmt(receiptResult.previousDue)}</span></div>
              <div className="flex justify-between font-bold border-t border-zinc-200 dark:border-zinc-700 pt-1">
                <span>Remaining Due:</span>
                <span className={receiptResult.remainingDue === 0 ? "text-emerald-600" : "text-rose-600"}>
                  {fmt(receiptResult.remainingDue)}
                </span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
            >
              🖨️ Print Due Clearance Slip
            </button>

            <button
              onClick={() => setReceiptResult(null)}
              className="w-full py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
