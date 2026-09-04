"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface PosItem {
  cartId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  deviceUnitId?: string;
  serialNumber?: string;
  imei1?: string;
  cosmeticGrade?: string;
  batteryHealth?: number;
  warranty?: string;
  isSerialized: boolean;
  /** On-hand at the selected branch; undefined for serialized units. */
  availableStock?: number;
}

interface PosPreBooking {
  id: string;
  booking_number: string;
  total_price: number;
  advance_paid: number;
  remaining_due: number;
  status: string;
}

interface PosCustomer {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  email: string | null;
  loyalty_tier: string;
  advance_balance: number;
  outstanding_due: number;
  credit_limit: number;
}

interface PosShift {
  id: string;
  shift_number: string;
  warehouse_id: string;
  opening_float: number;
  cash_sales_total: number;
  card_sales_total: number;
  mobile_sales_total: number;
  wallet_sales_total: number;
  dues_created_total: number;
  dues_collected_total: number;
  closing_cash_expected: number;
  status: "open" | "closed";
  cash_movements?: { id: string; type: string; amount: number; reason: string }[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

const fmt = (n: number) => formatBDT(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

import { useRBAC } from "@/lib/rbac/rbac-context";
import { formatBDT } from "@/lib/currency";

export default function PosTerminalPage() {
  const { activeBranch, branchContext, isOwner } = useRBAC();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranch?.id || "");
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  
  // Search & Cart
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ deviceUnits: any[]; products: any[] }>({ deviceUnits: [], products: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [cart, setCart] = useState<PosItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  
  // Customer & NFC
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerPreBookings, setCustomerPreBookings] = useState<PosPreBooking[]>([]);
  const [selectedPreBooking, setSelectedPreBooking] = useState<PosPreBooking | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [nfcScanning, setNfcScanning] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  // Shift Management Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState("5000");
  const [actualCashInput, setActualCashInput] = useState("");
  const [movementType, setMovementType] = useState<"cash_in" | "cash_out" | "drop">("drop");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");

  // Payment & Checkout Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: number; reference: string }[]>([
    { method: "cash", amount: 0, reference: "" }
  ]);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [cashTendered, setCashTendered] = useState("");

  // Scanner Barcode Buffer
  const barcodeBuffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // The keydown listener is attached once; it calls through this ref so it
  // always sees the current cart and branch instead of the first render's.
  const executeInstantScanRef = useRef<(code: string) => void>(() => {});

  // Sync when activeBranch switches from header
  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranch(activeBranch.id);
    }
  }, [activeBranch]);

  // Load Warehouses & Active Shift
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch("/api/v1/admin/warehouses");
        const json = await res.json();
        if (json.success && json.data?.length) {
          // Only offer branches this user is actually assigned to — the shift
          // and checkout APIs reject the rest, so listing them would just hand
          // the cashier a branch that 403s.
          const allowed = branchContext.isAllBranches
            ? json.data
            : json.data.filter((w: any) => branchContext.branchIds.includes(w.id));

          setWarehouses(allowed);
          if (!selectedBranch && allowed.length > 0) {
            const defaultBranch =
              (activeBranch && allowed.find((w: any) => w.id === activeBranch.id)) ||
              allowed.find((w: any) => w.is_default) ||
              allowed[0];
            setSelectedBranch(defaultBranch.id);
          }
        }
      } catch (err) {
        console.error("Failed to load warehouses", err);
      }
    }
    loadBranches();
  }, []);

  // Re-read the open shift for the current branch. Called on branch change and
  // after anything that moves the drawer, so the reconciliation figures the
  // cashier sees are the ones the server will close against.
  const refreshShift = useCallback(async (promptIfMissing = false) => {
    if (!selectedBranch) return;
    try {
      const res = await fetch(`/api/v1/admin/pos/shifts?warehouse_id=${selectedBranch}&status=open`);
      const json = await res.json();
      if (json.success && json.data) {
        setActiveShift(json.data);
      } else {
        setActiveShift(null);
        if (promptIfMissing) setShowOpenShiftModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch shift", err);
    }
  }, [selectedBranch]);

  useEffect(() => {
    refreshShift(true);
  }, [refreshShift]);

  // Hardware Scanner Listener (keystroke velocity detection)
  //
  // Two things this must not do: fire while someone is typing into a field, and
  // read a stale cart. The listener is registered once, so it reads live state
  // through refs rather than closing over the render it was attached in.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // A cashier typing a phone number, a discount or a tender amount is not
      // scanning. Without this guard, Enter in any field added a product.
      if (isTypingTarget(e.target)) {
        barcodeBuffer.current = "";
        return;
      }

      const currentTime = Date.now();

      if (currentTime - lastKeyTime.current > 60) {
        barcodeBuffer.current = "";
      }
      lastKeyTime.current = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 4) {
          e.preventDefault();
          executeInstantScanRef.current(barcodeBuffer.current);
        }
        barcodeBuffer.current = "";
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const executeInstantScan = async (code: string) => {
    try {
      const res = await fetch(`/api/v1/admin/pos/search?q=${encodeURIComponent(code)}&warehouse_id=${selectedBranch}`);
      const json = await res.json();
      if (json.success) {
        if (json.data.deviceUnits?.length > 0) {
          addDeviceUnitToCart(json.data.deviceUnits[0]);
        } else if (json.data.products?.length > 0) {
          addProductToCart(json.data.products[0]);
        }
      }
    } catch (err) {
      console.error("Scan error", err);
    }
  };

  // Refresh the ref the (once-registered) scanner listener calls through.
  useEffect(() => {
    executeInstantScanRef.current = executeInstantScan;
  });

  // Perform Live Universal Search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults({ deviceUnits: [], products: [] });
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/admin/pos/search?q=${encodeURIComponent(query)}&warehouse_id=${selectedBranch}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [selectedBranch]);

  // Add Item to Cart
  const addDeviceUnitToCart = (unit: any) => {
    const newItem: PosItem = {
      cartId: `UNIT-${unit.id}`,
      productId: unit.products?.id || unit.product_id,
      name: `${unit.products?.name || "Device Unit"} [${unit.serial_number}]`,
      price: Number(unit.selling_price),
      quantity: 1,
      deviceUnitId: unit.id,
      serialNumber: unit.serial_number,
      imei1: unit.imei_1,
      cosmeticGrade: unit.cosmetic_grade,
      batteryHealth: unit.battery_health_pct,
      warranty: unit.products?.warranty || "1 Year SMSTech Warranty",
      isSerialized: true
    };
    // Functional update, and the duplicate check happens inside it — reading
    // `cart` here would use whatever the scanner listener last closed over.
    setCart(prev => {
      if (prev.some(i => i.deviceUnitId === unit.id)) {
        alert("That serialized unit is already in the cart.");
        return prev;
      }
      return [newItem, ...prev];
    });
    setSearchQuery("");
    setSearchResults({ deviceUnits: [], products: [] });
  };

  const addProductToCart = (product: any) => {
    const available = Number(product.available_quantity ?? 0);
    const heldOnVariations = Number(product.variation_quantity ?? 0);

    // The till refuses to ring up stock the branch does not hold. Checkout
    // enforces this again server-side; this is so the cashier finds out at the
    // moment of scanning rather than at settlement.
    if (available <= 0) {
      alert(
        heldOnVariations > 0
          ? `"${product.name}" has ${heldOnVariations} in stock at this branch, but all of it is held against variations. The till sells the base product only — move the stock or sell it from the variation.`
          : `"${product.name}" is out of stock at this branch.`,
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => !i.isSerialized && i.productId === product.id);

      if (existing) {
        if (existing.quantity >= available) {
          alert(`Only ${available} of "${product.name}" in stock at this branch.`);
          return prev;
        }
        return prev.map(i =>
          i.cartId === existing.cartId
            ? { ...i, quantity: i.quantity + 1, availableStock: available }
            : i
        );
      }

      const newItem: PosItem = {
        cartId: `PROD-${product.id}`,
        productId: product.id,
        name: product.name,
        price: Number(product.base_price),
        quantity: 1,
        warranty: product.warranty || "Standard Warranty",
        isSerialized: false,
        availableStock: available
      };
      return [newItem, ...prev];
    });

    setSearchQuery("");
    setSearchResults({ deviceUnits: [], products: [] });
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item;
      if (item.isSerialized) return item; // Serialized items are strictly 1 unit

      const ceiling = item.availableStock ?? Infinity;
      const requested = item.quantity + delta;

      if (requested > ceiling) {
        alert(`Only ${ceiling} of "${item.name}" in stock at this branch.`);
        return item;
      }

      return { ...item, quantity: Math.max(1, requested) };
    }));
  };

  const removeItem = (cartId: string) => {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomer(null);
    setCustomerPreBookings([]);
    setSelectedPreBooking(null);
  };

  // NFC Card Reader Simulator & WebNFC
  const triggerNfcTap = async (simulatedUid?: string) => {
    setNfcScanning(true);
    try {
      let uid = simulatedUid;
      if (!uid && "NDEFReader" in window) {
        try {
          const ndef = new (window as any).NDEFReader();
          await ndef.scan();
          ndef.onreading = (event: any) => {
            fetchCustomerByNfc(event.serialNumber);
          };
          return;
        } catch {
          // Fallback to simulation
          uid = "NFC-CARD-99281";
        }
      } else if (!uid) {
        uid = "NFC-CARD-99281";
      }

      await fetchCustomerByNfc(uid);
    } catch (err: any) {
      alert("NFC Reader error: " + err.message);
    } finally {
      setNfcScanning(false);
    }
  };

  const applyCustomerLookup = (data: any) => {
    setCustomer(data.customer);
    // The lookup already returns these; they used to be fetched and thrown
    // away, leaving the cashier no way to settle a pre-booking at the till.
    const open = (data.preBookings || []).filter(
      (b: PosPreBooking) => b.status !== "fulfilled" && b.status !== "cancelled"
    );
    setCustomerPreBookings(open);
    setSelectedPreBooking(null);
  };

  const fetchCustomerByNfc = async (uid: string) => {
    try {
      const res = await fetch(`/api/v1/admin/pos/nfc-lookup?uid=${encodeURIComponent(uid)}`);
      const json = await res.json();
      if (json.success && json.data?.customer) {
        applyCustomerLookup(json.data);
      } else {
        alert("No registered customer card found for NFC UID: " + uid);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchManualCustomer = async () => {
    if (!customerSearch.trim()) return;
    try {
      const res = await fetch(`/api/v1/admin/pos/nfc-lookup?query=${encodeURIComponent(customerSearch)}`);
      const json = await res.json();
      if (json.success && json.data?.customer) {
        applyCustomerLookup(json.data);
        setShowCustomerModal(false);
      } else if (json.success && json.data?.matches?.length > 1) {
        const names = json.data.matches
          .map((m: any) => `${m.name} (${m.phone})`)
          .join("\n");
        alert(`${json.data.matches.length} customers match that search:\n\n${names}\n\nSearch by full phone number or customer code.`);
      } else {
        alert("Customer not found");
      }
    } catch (err) {
      alert("Customer lookup failed");
    }
  };

  // Calculations
  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const finalTotal = Math.max(0, subtotal - discount);

  const totalTendered = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const tenderDifference = round2(finalTotal - totalTendered);

  // Cash handed over by the customer, for working out change. Separate from
  // the cash *line* on the invoice, which is only ever what the sale is worth.
  const cashLineTotal = splitPayments
    .filter(p => p.method === "cash")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cashGiven = Number(cashTendered) || 0;
  const changeDue = round2(Math.max(0, cashGiven - cashLineTotal));

  // Initialize split payments with final total
  const openCheckout = () => {
    if (!activeShift) {
      alert("Open a register shift before taking payment.");
      setShowOpenShiftModal(true);
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    // A pre-booking advance settles part of the bill automatically.
    if (selectedPreBooking) {
      const advance = Math.min(Number(selectedPreBooking.advance_paid) || 0, finalTotal);
      const remainder = round2(finalTotal - advance);
      setSplitPayments([
        { method: "prebooking", amount: advance, reference: selectedPreBooking.booking_number },
        ...(remainder > 0 ? [{ method: "cash", amount: remainder, reference: "" }] : [])
      ]);
    } else {
      setSplitPayments([{ method: "cash", amount: finalTotal, reference: "" }]);
    }

    setCashTendered("");
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async () => {
    if (Math.abs(tenderDifference) > 0.01) {
      alert(
        `Payments total ${fmt(totalTendered)} but the invoice is ${fmt(finalTotal)}. They must match.`
      );
      return;
    }

    // These are also enforced server-side; checking here saves a round trip
    // and gives the cashier the reason immediately.
    const advanceLine = splitPayments
      .filter(p => p.method === "advance")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (advanceLine > 0 && advanceLine > (customer?.advance_balance ?? 0) + 0.01) {
      alert(
        `Wallet holds ${fmt(customer?.advance_balance ?? 0)} but ${fmt(advanceLine)} was tendered from it.`
      );
      return;
    }

    const dueLine = splitPayments
      .filter(p => p.method === "due")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (dueLine > 0 && customer) {
      const projected = (customer.outstanding_due || 0) + dueLine;
      if (projected > (customer.credit_limit || 0) + 0.01) {
        alert(
          `That due takes ${customer.name} to ${fmt(projected)}, over their ${fmt(customer.credit_limit || 0)} credit limit.`
        );
        return;
      }
    }

    if (cashLineTotal > 0 && cashGiven > 0 && cashGiven < cashLineTotal) {
      alert(`Cash received ${fmt(cashGiven)} is less than the ${fmt(cashLineTotal)} cash line.`);
      return;
    }

    setProcessingCheckout(true);
    try {
      const payload = {
        warehouse_id: selectedBranch,
        shift_id: activeShift?.id,
        customer_id: customer?.id || null,
        customer_name: customer?.name || "Counter Customer",
        customer_phone: customer?.phone || "01700000000",
        customer_email: customer?.email || null,
        pre_booking_id: selectedPreBooking?.id || null,
        items: cart.map(i => ({
          product_id: i.productId,
          product_name: i.name,
          unit_price: i.price,
          quantity: i.quantity,
          device_unit_id: i.deviceUnitId,
          serial_number: i.serialNumber,
          imei_1: i.imei1,
          warranty: i.warranty
        })),
        payments: splitPayments,
        discount_amount: discount,
        notes: checkoutNotes
      };

      const res = await fetch("/api/v1/admin/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        setCompletedOrder({ ...json.data, changeDue, cashGiven });
        setShowCheckoutModal(false);
        setCart([]);
        setDiscount(0);
        setCustomer(null);
        setCustomerPreBookings([]);
        setSelectedPreBooking(null);
        setCashTendered("");
        setCheckoutNotes("");

        // The sale just moved the drawer. Take the shift the API handed back
        // so the reconciliation screen reflects it — this used to stay at the
        // opening float all day.
        if (json.data.shift) {
          setActiveShift(json.data.shift);
        } else {
          refreshShift();
        }
      } else {
        alert("Checkout failed: " + (json.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error processing checkout: " + err.message);
    } finally {
      setProcessingCheckout(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-zinc-100 dark:bg-zinc-950 -m-6">
      {/* Top POS Header Bar */}
      <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-extrabold text-lg text-zinc-900 dark:text-white tracking-tight">SMSTech POS</span>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:border-zinc-700" />

          {/* Today's takings live in the sales register */}
          <Link
            href="/admin/pos/orders"
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Sales register
          </Link>

          <div className="h-5 w-px bg-zinc-200 dark:border-zinc-700" />

          {/* Branch Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Branch:</span>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-900 dark:text-white focus:outline-none"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          {/* Active Shift Indicator */}
          {activeShift ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{activeShift.shift_number}</span>
              <span className="text-zinc-500 dark:text-zinc-400">· Float: {fmt(activeShift.opening_float)}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowOpenShiftModal(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              ⚠️ Open Register Shift
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeShift && (
            <>
              <button
                onClick={() => setShowCashMovementModal(true)}
                className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
              >
                💵 Drawer Drop / In
              </button>
              <button
                onClick={() => setShowCloseShiftModal(true)}
                className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800/60 text-xs font-bold rounded-lg transition-colors"
              >
                🔒 Close Shift
              </button>
            </>
          )}
          <Link
            href="/admin/labels"
            className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
          >
            🏷️ Print Labels
          </Link>
        </div>
      </header>

      {/* Main Split Layout: Left Catalog/Search, Right Active Ticket */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left 7 Columns: Scanner, Search & Quick Catalog */}
        <div className="col-span-7 p-4 flex flex-col border-r border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Universal Search Input */}
          <div className="relative mb-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Scan Barcode / IMEI / Serial / SKU or Type Product Name..."
              className="w-full pl-10 pr-10 py-3 bg-white dark:bg-zinc-900 border-2 border-blue-500/50 rounded-xl text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-600 shadow-sm"
              autoFocus
            />
            <span className="absolute left-3.5 top-3.5 text-zinc-400 text-base">🔍</span>
            {isSearching && (
              <span className="absolute right-3.5 top-3.5 text-xs text-blue-500 animate-spin">⌛</span>
            )}
          </div>

          {/* Quick Scanner Tip */}
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-3 px-1">
            <span>💡 <b>Hardware Scanner Ready:</b> Point your USB/Bluetooth barcode gun and trigger.</span>
            <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">Auto-Focus Keylistener Active</span>
          </div>

          {/* Search Results Display or Live Inventory List */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
            {searchQuery ? (
              <>
                {/* Serialized Device Units */}
                {searchResults.deviceUnits.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider">Serialized Units (Unique IMEI/Serial)</p>
                    {searchResults.deviceUnits.map(unit => (
                      <div
                        key={unit.id}
                        onClick={() => addDeviceUnitToCart(unit)}
                        className="flex items-center justify-between p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 cursor-pointer transition-all"
                      >
                        <div>
                          <p className="font-bold text-sm text-zinc-900 dark:text-white">{unit.products?.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 font-mono">
                            <span className="bg-blue-200 dark:bg-blue-900 px-1.5 py-0.5 rounded text-blue-900 dark:text-blue-200 font-bold">SN: {unit.serial_number}</span>
                            {unit.imei_1 && <span>IMEI: {unit.imei_1}</span>}
                            {unit.battery_health_pct && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🔋 {unit.battery_health_pct}%</span>}
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded font-semibold">{unit.cosmetic_grade}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-sm text-zinc-900 dark:text-white">{fmt(unit.selling_price)}</p>
                          <span className="text-xs text-blue-600 font-bold">+ Add Unit</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bulk / General Products */}
                {searchResults.products.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">Catalog Products (Bulk / Standard)</p>
                    {searchResults.products.map(prod => {
                      const available = Number(prod.available_quantity ?? 0);
                      const heldOnVariations = Number(prod.variation_quantity ?? 0);
                      const sellable = available > 0;

                      return (
                        <div
                          key={prod.id}
                          onClick={sellable ? () => addProductToCart(prod) : undefined}
                          aria-disabled={!sellable}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            sellable
                              ? "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                              : "border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/60 dark:bg-zinc-800/20 opacity-70 cursor-not-allowed"
                          }`}
                        >
                          <div>
                            <p className="font-bold text-sm text-zinc-900 dark:text-white">{prod.name}</p>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">SKU: {prod.sku} · {prod.brand}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-sm text-zinc-900 dark:text-white">{fmt(prod.base_price)}</p>
                            {sellable ? (
                              <div className="flex items-center justify-end gap-2 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    available <= 3
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }`}
                                >
                                  {available} in stock
                                </span>
                                <span className="text-xs text-emerald-600 font-bold">+ Add to Cart</span>
                              </div>
                            ) : (
                              <span className="block text-[11px] font-bold text-red-500 mt-0.5">
                                {heldOnVariations > 0
                                  ? `${heldOnVariations} held on variations — not sellable here`
                                  : "Out of stock at this branch"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {searchResults.deviceUnits.length === 0 && searchResults.products.length === 0 && !isSearching && (
                  <div className="py-12 text-center text-zinc-400 text-sm">
                    No items matching &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-zinc-400">
                <span className="text-4xl">🎯</span>
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300 mt-2">Ready to Scan or Search</p>
                <p className="text-xs text-zinc-500 mt-1">Scan any hardware barcode/IMEI with your scanner or type above.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Customer & Active Ticket */}
        <div className="col-span-5 p-4 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Customer & NFC Header */}
          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 mb-3">
            {customer ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">{customer.name}</span>
                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-[10px] rounded font-bold">{customer.customer_code}</span>
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] rounded font-bold">{customer.loyalty_tier}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                    <span>📱 {customer.phone}</span>
                    {customer.advance_balance > 0 && (
                      <span className="text-emerald-600 font-semibold">Advance: {fmt(customer.advance_balance)}</span>
                    )}
                    {customer.outstanding_due > 0 && (
                      <span className="text-rose-600 font-semibold">Due: {fmt(customer.outstanding_due)}</span>
                    )}
                  </div>

                  {customerPreBookings.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-bold">Open Pre-Bookings</p>
                      {customerPreBookings.map(pb => (
                        <button
                          key={pb.id}
                          onClick={() => setSelectedPreBooking(selectedPreBooking?.id === pb.id ? null : pb)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                            selectedPreBooking?.id === pb.id
                              ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-800 dark:text-emerald-300"
                              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400"
                          }`}
                        >
                          <span className="font-mono">{pb.booking_number}</span>
                          <span>
                            {fmt(pb.advance_paid)} paid
                            {selectedPreBooking?.id === pb.id ? " · applying" : " · tap to apply"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCustomer(null);
                    setCustomerPreBookings([]);
                    setSelectedPreBooking(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-red-500 font-bold p-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerNfcTap()}
                    disabled={nfcScanning}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>💳</span>
                    {nfcScanning ? "Scanning Card..." : "Tap NFC Card"}
                  </button>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all"
                  >
                    👤 Select / Find Customer
                  </button>
                </div>
                <span className="text-[11px] text-zinc-400 font-medium">Walk-In Customer</span>
              </div>
            )}
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="py-20 text-center text-zinc-400">
                <span className="text-3xl">🛒</span>
                <p className="text-xs font-semibold mt-2">Cart is empty</p>
                <p className="text-[11px] text-zinc-500">Scan or click products to begin sale</p>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.cartId}
                  className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">{item.name}</p>
                    {item.isSerialized && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">SN: {item.serialNumber}</span>
                        {item.cosmeticGrade && <span>· Grade {item.cosmeticGrade}</span>}
                        {item.batteryHealth && <span>· 🔋{item.batteryHealth}%</span>}
                      </div>
                    )}
                    <p className="text-xs font-extrabold text-blue-600 dark:text-blue-400 mt-1">{fmt(item.price)}</p>
                  </div>

                  {/* Quantity & Delete Controls */}
                  <div className="flex items-center gap-2">
                    {!item.isSerialized ? (
                      <div className="flex items-center border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.cartId, -1)}
                          className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >-</button>
                        <span className="px-2 text-xs font-extrabold text-zinc-900 dark:text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartId, 1)}
                          className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >+</button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded">1 Unit</span>
                    )}

                    <button
                      onClick={() => removeItem(item.cartId)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 text-xs font-bold"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Checkout Bottom Bar */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-3 space-y-2">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span className="font-bold text-zinc-900 dark:text-white">{fmt(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400">
              <span>Discount</span>
              <div className="flex items-center gap-1">
                <span>৳</span>
                <input
                  type="number"
                  value={discount || ""}
                  onChange={e => setDiscount(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
                  placeholder="0"
                  className="w-20 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-right text-xs font-bold text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-between text-base font-extrabold text-zinc-900 dark:text-white pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <span>Payable Total</span>
              <span className="text-blue-600 dark:text-blue-400 text-lg">{fmt(finalTotal)}</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="col-span-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                Clear
              </button>
              <button
                onClick={openCheckout}
                disabled={cart.length === 0}
                className="col-span-3 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>Charge {fmt(finalTotal)}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL 1: Split Payment & Checkout Modal --- */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Split-Payment Settlement</h2>
                <p className="text-xs text-zinc-500">Invoice Total: <b className="text-blue-600">{fmt(finalTotal)}</b></p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
            </div>

            {/* Split Payment Rows */}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {splitPayments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <select
                    value={p.method}
                    onChange={e => {
                      const updated = [...splitPayments];
                      updated[idx].method = e.target.value;
                      setSplitPayments(updated);
                    }}
                    className="px-2.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card (POS Terminal)</option>
                    <option value="bkash">bKash Mobile</option>
                    <option value="nagad">Nagad Mobile</option>
                    {customer && customer.advance_balance > 0 && (
                      <option value="advance">Customer Advance Wallet (Avail: {fmt(customer.advance_balance)})</option>
                    )}
                    {selectedPreBooking && (
                      <option value="prebooking">Pre-Booking Advance ({selectedPreBooking.booking_number})</option>
                    )}
                    {customer && (
                      <option value="due">Create Due Balance (Limit: {fmt(customer.credit_limit || 0)})</option>
                    )}
                  </select>

                  <input
                    type="number"
                    value={p.amount}
                    onChange={e => {
                      const updated = [...splitPayments];
                      updated[idx].amount = Number(e.target.value);
                      setSplitPayments(updated);
                    }}
                    placeholder="Amount"
                    className="w-28 px-2.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-extrabold text-zinc-900 dark:text-white text-right"
                  />

                  <input
                    type="text"
                    value={p.reference}
                    onChange={e => {
                      const updated = [...splitPayments];
                      updated[idx].reference = e.target.value;
                      setSplitPayments(updated);
                    }}
                    placeholder="Ref / TrxID (optional)"
                    className="flex-1 px-2.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white"
                  />

                  {splitPayments.length > 1 && (
                    <button
                      onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                      className="text-xs text-red-500 font-bold p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Split Method Button */}
            <button
              onClick={() => setSplitPayments([...splitPayments, { method: "cash", amount: 0, reference: "" }])}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              + Add Another Payment Method (Split)
            </button>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Invoice Notes (Optional)</label>
              <input
                type="text"
                value={checkoutNotes}
                onChange={e => setCheckoutNotes(e.target.value)}
                placeholder="e.g. Warranty registration remarks"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white"
              />
            </div>

            {/* Cash received & change — the counter still hands over notes, so
                the cash line on the invoice and what the customer gives are
                two different numbers. */}
            {cashLineTotal > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-200">Cash Received</label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={e => setCashTendered(e.target.value)}
                    placeholder={String(cashLineTotal)}
                    className="w-32 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-extrabold text-right text-zinc-900 dark:text-white"
                  />
                </div>
                {cashGiven > 0 && (
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-amber-900 dark:text-amber-200">Change Due</span>
                    <span className={cashGiven < cashLineTotal ? "text-rose-600" : "text-emerald-600"}>
                      {cashGiven < cashLineTotal
                        ? `Short by ${fmt(cashLineTotal - cashGiven)}`
                        : fmt(changeDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Total Balance Check */}
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-between text-xs font-bold">
              <span>Total Tendered: {fmt(totalTendered)}</span>
              <span className={Math.abs(tenderDifference) < 0.01 ? "text-emerald-600" : "text-rose-600"}>
                {Math.abs(tenderDifference) < 0.01
                  ? "✓ Tender Balanced"
                  : tenderDifference > 0
                    ? `Short by ${fmt(tenderDifference)}`
                    : `Over by ${fmt(-tenderDifference)}`}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckoutSubmit}
                disabled={processingCheckout || Math.abs(tenderDifference) > 0.01}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingCheckout ? "Settling..." : "Complete & Settle Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Completed Order & Thermal/A4 Print Modal --- */}
      {completedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <span className="text-5xl">🎉</span>
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">Transaction Succeeded!</h2>
            <p className="text-xs text-zinc-500 font-mono">Invoice #{completedOrder.orderNumber}</p>
            {completedOrder.changeDue > 0 && (
              <div className="py-2 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-bold">Change to hand back</p>
                <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{fmt(completedOrder.changeDue)}</p>
              </div>
            )}
            {completedOrder.dueAmount > 0 && (
              <p className="text-xs font-bold text-rose-600">Due recorded: {fmt(completedOrder.dueAmount)}</p>
            )}
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fmt(completedOrder.total)}</p>

            <div className="grid grid-cols-2 gap-2 pt-3">
              <Link
                href={`/admin/pos/thermal-receipt/${completedOrder.order?.id || completedOrder.orderNumber}`}
                target="_blank"
                className="py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span> Thermal 80mm
              </Link>
              <Link
                href={`/api/v1/admin/orders/${completedOrder.order?.id}/invoice`}
                target="_blank"
                className="py-3 bg-blue-600 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5"
              >
                <span>📄</span> Legal A4 PDF
              </Link>
            </div>

            <button
              onClick={() => setCompletedOrder(null)}
              className="w-full py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700"
            >
              Start Next Sale
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Open Register Shift --- */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Open Cash Register Shift</h2>
            <p className="text-xs text-zinc-500">Enter the opening cash float in the register drawer for today.</p>
            
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Opening Cash Float (BDT)</label>
              <input
                type="number"
                value={openingFloatInput}
                onChange={e => setOpeningFloatInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-extrabold text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowOpenShiftModal(false)}
                className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const res = await fetch("/api/v1/admin/pos/shifts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "open_shift", warehouse_id: selectedBranch, opening_float: openingFloatInput })
                  });
                  const json = await res.json();
                  if (json.success) {
                    setActiveShift(json.data);
                    setShowOpenShiftModal(false);
                  } else {
                    alert(json.error || "Failed to open shift");
                    // Another till may have opened one; pick it up.
                    await refreshShift();
                  }
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Close Register Shift Reconciliation --- */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">End-of-Day Shift Reconciliation</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-2">
              {isOwner
                ? "As Superadmin you sit at the top of every approval chain, so this closes the drawer outright. The count is still recorded against your name."
                : "The register frees up immediately, but the shift stays open on the books until every approver in this branch’s chain has signed off."}
            </p>
            <div className="space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl text-xs">
              <div className="flex justify-between"><span>Opening Float:</span><span className="font-bold">{fmt(activeShift.opening_float)}</span></div>
              <div className="flex justify-between"><span>Cash Sales:</span><span className="font-bold">{fmt(activeShift.cash_sales_total)}</span></div>
              <div className="flex justify-between"><span>Dues Collected (cash):</span><span className="font-bold">{fmt(activeShift.dues_collected_total)}</span></div>
              {(activeShift.cash_movements || []).length > 0 && (
                <>
                  <div className="pt-1 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-[10px] uppercase tracking-wide text-zinc-400 font-bold">Drawer Movements</div>
                  {(activeShift.cash_movements || []).map(m => (
                    <div key={m.id} className="flex justify-between text-[11px]">
                      <span className="capitalize text-zinc-500">{m.type.replace("_", " ")} — {m.reason}</span>
                      <span className={m.type === "cash_in" || m.type === "float_adjustment" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {m.type === "cash_in" || m.type === "float_adjustment" ? "+" : "−"}{fmt(m.amount)}
                      </span>
                    </div>
                  ))}
                </>
              )}
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                <div className="flex justify-between text-zinc-500"><span>Card Sales (not in drawer):</span><span>{fmt(activeShift.card_sales_total)}</span></div>
                <div className="flex justify-between text-zinc-500"><span>Mobile (not in drawer):</span><span>{fmt(activeShift.mobile_sales_total)}</span></div>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700 font-extrabold">
                <span>Expected Drawer Cash:</span>
                {/* Computed by the server (shift_expected_cash) and returned with
                    the shift, so this is the exact figure the close-out compares
                    against — float + cash sales + dues collected ± movements. */}
                <span className="text-blue-600">{fmt(activeShift.closing_cash_expected)}</span>
              </div>
              {actualCashInput !== "" && (
                <div className="flex justify-between font-extrabold">
                  <span>Variance:</span>
                  <span className={Math.abs(Number(actualCashInput) - Number(activeShift.closing_cash_expected)) < 0.01 ? "text-emerald-600" : "text-rose-600"}>
                    {fmt(Number(actualCashInput) - Number(activeShift.closing_cash_expected))}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Actual Physical Cash Counted in Drawer (BDT)</label>
              <input
                type="number"
                value={actualCashInput}
                onChange={e => setActualCashInput(e.target.value)}
                placeholder="Count physical cash..."
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-extrabold text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseShiftModal(false)}
                className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const res = await fetch("/api/v1/admin/pos/shifts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "close_shift", shift_id: activeShift.id, closing_cash_actual: actualCashInput })
                  });
                  const json = await res.json();
                  if (json.success) {
                    const diff = Number(json.data.difference) || 0;
                    const variance =
                      diff === 0
                        ? "Drawer balanced exactly."
                        : `Drawer is ${fmt(Math.abs(diff))} ${diff > 0 ? "over" : "short"}.`;
                    alert(
                      `${variance}\n\n${
                        json.message ||
                        (isOwner ? "Drawer closed." : "Submitted for approval.")
                      }`,
                    );
                    setActiveShift(null);
                    setActualCashInput("");
                    setShowCloseShiftModal(false);
                  } else {
                    alert(json.error || "Failed to close shift");
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                {isOwner ? "Close Drawer" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Cash Movement (Drop / In) --- */}
      {showCashMovementModal && activeShift && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Drawer Cash Adjustment</h2>
            
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Adjustment Type</label>
              <select
                value={movementType}
                onChange={e => setMovementType(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
              >
                <option value="drop">Cash Drop (Move cash to Safe Vault)</option>
                <option value="cash_in">Cash In (Add float/petty cash)</option>
                <option value="cash_out">Cash Out (Expense payout)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Amount (BDT)</label>
              <input
                type="number"
                value={movementAmount}
                onChange={e => setMovementAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-extrabold text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Reason / Note</label>
              <input
                type="text"
                value={movementReason}
                onChange={e => setMovementReason(e.target.value)}
                placeholder="e.g. Mid-day safe drop"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCashMovementModal(false)}
                className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const res = await fetch("/api/v1/admin/pos/shifts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "cash_movement",
                      shift_id: activeShift.id,
                      movement_type: movementType,
                      movement_amount: movementAmount,
                      reason: movementReason
                    })
                  });
                  const json = await res.json();
                  if (json.success) {
                    setShowCashMovementModal(false);
                    setMovementAmount("");
                    setMovementReason("");
                    // Drawer changed, so pull the recalculated expected cash.
                    await refreshShift();
                  } else {
                    alert(json.error || "Failed to record movement");
                  }
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Record Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 6: Customer Search Modal --- */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Find Customer</h2>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Phone / Name / Code</label>
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="017... or CUST-XXXXX"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={searchManualCustomer}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Lookup Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
