"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface PosItem {
  cartId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  /** Set when a specific variation was picked; checkout draws that row down. */
  variationId?: string;
  variationName?: string;
  image?: string;
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

interface PosVariation {
  id: string;
  name: string;
  sku: string;
  price: number;
  attributes: Record<string, unknown> | null;
  images: string[];
  available_quantity: number;
}

interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  base_price: number;
  images: string[];
  warranty: string | null;
  available_quantity: number;
  variation_quantity: number;
  variations: PosVariation[];
}

interface PosCatalog {
  recent: PosProduct[];
  top: PosProduct[];
  browse: PosProduct[];
  top_seller_window_days: number;
}

/** First usable image on a product or variation, if it has one. */
const firstImage = (images?: string[] | null) =>
  (Array.isArray(images) ? images.find((src) => typeof src === "string" && src.trim()) : null) || null;

/** Total the till can actually sell — pooled stock plus every variation's. */
const sellableStock = (p: PosProduct) =>
  Number(p.available_quantity ?? 0) +
  (p.variations || []).reduce((s, v) => s + Number(v.available_quantity ?? 0), 0);

const fmt = (n: number) => formatBDT(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

import { useRBAC } from "@/lib/rbac/rbac-context";
import { formatBDT } from "@/lib/currency";
import { resolveDiscount } from "@/lib/pos/checkout-math";
import { notify } from "@/components/ui/toast";

/**
 * Product thumbnail. Falls back to the first letter of the name — a blank
 * square in a list of tiles reads as a broken row rather than a product
 * nobody has photographed yet.
 */
function ProductThumb({
  src,
  name,
  className = "h-12 w-12",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`${className} shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 font-extrabold`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${className} shrink-0 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700`}
    />
  );
}

/** Stock badge shared by every product surface on the till. */
function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
        Out of stock
      </span>
    );
  }

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        available <= 3
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
      }`}
    >
      {available} in stock
    </span>
  );
}

/** One product in a vertical list: search results and the browse grid. */
function ProductRow({
  product,
  onSelect,
}: {
  product: PosProduct;
  onSelect: (product: PosProduct) => void;
}) {
  const variations = product.variations || [];
  const pooled = Number(product.available_quantity ?? 0);
  const sellable = sellableStock(product) > 0;
  const inStockVariations = variations.filter(v => v.available_quantity > 0).length;

  return (
    <div
      onClick={sellable ? () => onSelect(product) : undefined}
      aria-disabled={!sellable}
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
        sellable
          ? "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
          : "border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/60 dark:bg-zinc-800/20 opacity-70 cursor-not-allowed"
      }`}
    >
      <ProductThumb src={firstImage(product.images)} name={product.name} />

      <div className="min-w-0 flex-1">
        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{product.name}</p>
        <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">
          SKU: {product.sku || "—"}{product.brand ? ` · ${product.brand}` : ""}
        </p>
        {variations.length > 0 && (
          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {inStockVariations > 0
              ? `${inStockVariations} variation${inStockVariations === 1 ? "" : "s"} available`
              : "Variations out of stock"}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="font-extrabold text-sm text-zinc-900 dark:text-white">{fmt(product.base_price)}</p>
        <div className="flex items-center justify-end gap-2 mt-0.5">
          <StockBadge available={variations.length > 0 ? sellableStock(product) : pooled} />
          {sellable && (
            <span className="text-xs text-emerald-600 font-bold">
              {variations.length > 0 ? "Choose →" : "+ Add"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** A horizontal row of product cards — "last sold", "most sold". */
function ProductStrip({
  title,
  hint,
  products,
  onSelect,
}: {
  title: string;
  hint: string;
  products: PosProduct[];
  onSelect: (product: PosProduct) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">{title}</p>
        <span className="text-[10px] text-zinc-400 font-semibold">{hint}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {products.map(product => {
          const sellable = sellableStock(product) > 0;
          const hasVariations = (product.variations || []).length > 0;

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              disabled={!sellable}
              className={`w-32 shrink-0 p-2 rounded-xl border text-left transition-all ${
                sellable
                  ? "border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer"
                  : "border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/60 dark:bg-zinc-800/20 opacity-60 cursor-not-allowed"
              }`}
            >
              <ProductThumb
                src={firstImage(product.images)}
                name={product.name}
                className="h-20 w-full"
              />
              <p className="mt-1.5 text-[11px] font-bold text-zinc-900 dark:text-white leading-tight line-clamp-2">
                {product.name}
              </p>
              <p className="mt-1 text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {fmt(product.base_price)}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <StockBadge available={sellableStock(product)} />
                {hasVariations && (
                  <span className="text-[9px] font-bold text-zinc-400 uppercase">opts</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PosTerminalPage() {
  const { activeBranch, branchContext, isOwner, hasPermission } = useRBAC();
  const canRegisterCustomers = hasPermission("customers:edit");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranch?.id || "");
  const [activeShift, setActiveShift] = useState<PosShift | null>(null);
  
  // Search & Cart
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ deviceUnits: any[]; products: any[] }>({ deviceUnits: [], products: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [cart, setCart] = useState<PosItem[]>([]);

  // Discount — taken either as a flat amount or as a percentage of the
  // subtotal. Only the resolved figure is ever sent to checkout.
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountInput, setDiscountInput] = useState("");

  // Quick catalogue shown before anyone types: what this branch sold last,
  // what it sells most, and what it is holding.
  const [catalog, setCatalog] = useState<PosCatalog>({
    recent: [],
    top: [],
    browse: [],
    top_seller_window_days: 90,
  });
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Product whose variations are being picked from.
  const [variationPicker, setVariationPicker] = useState<PosProduct | null>(null);

  // Customer
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerPreBookings, setCustomerPreBookings] = useState<PosPreBooking[]>([]);
  const [selectedPreBooking, setSelectedPreBooking] = useState<PosPreBooking | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalTab, setCustomerModalTab] = useState<"find" | "new">("find");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", credit_limit: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  
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

  // Quick catalogue for the idle screen. Reloaded on every branch change —
  // "last sold" and "most sold" are branch figures, not shop-wide ones.
  const loadCatalog = useCallback(async () => {
    if (!selectedBranch) return;
    setCatalogLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/pos/catalog?warehouse_id=${selectedBranch}`);
      const json = await res.json();
      if (json.success) setCatalog(json.data);
    } catch (err) {
      console.error("Failed to load POS catalogue", err);
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

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
          handleProductClick(json.data.products[0]);
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
        notify.warning("That serialized unit is already in the cart.");
        return prev;
      }
      return [newItem, ...prev];
    });
    setSearchQuery("");
    setSearchResults({ deviceUnits: [], products: [] });
  };

  /**
   * Ring up a catalogue product. A variation, when given, is what the sale is
   * actually against: its own price, its own stock row, and the id checkout
   * draws down. Without one the base product sells against the pooled row.
   */
  const addProductToCart = (product: PosProduct, variation?: PosVariation) => {
    const available = Number(
      (variation ? variation.available_quantity : product.available_quantity) ?? 0,
    );
    const heldOnVariations = Number(product.variation_quantity ?? 0);
    const label = variation ? `${product.name} · ${variation.name}` : product.name;

    // The till refuses to ring up stock the branch does not hold. Checkout
    // enforces this again server-side; this is so the cashier finds out at the
    // moment of scanning rather than at settlement.
    if (available <= 0) {
      notify.warning(
        !variation && heldOnVariations > 0
          ? `"${product.name}" has ${heldOnVariations} in stock at this branch, but all of it is held against variations — pick one.`
          : `"${label}" is out of stock at this branch.`,
      );
      return;
    }

    const cartId = variation ? `PROD-${product.id}-${variation.id}` : `PROD-${product.id}`;
    const price = Number(variation ? variation.price : product.base_price) || 0;
    const image = firstImage(variation?.images) || firstImage(product.images) || undefined;

    setCart(prev => {
      const existing = prev.find(i => !i.isSerialized && i.cartId === cartId);

      if (existing) {
        if (existing.quantity >= available) {
          notify.warning(`Only ${available} of "${label}" in stock at this branch.`);
          return prev;
        }
        return prev.map(i =>
          i.cartId === cartId
            ? { ...i, quantity: i.quantity + 1, availableStock: available }
            : i
        );
      }

      const newItem: PosItem = {
        cartId,
        productId: product.id,
        name: label,
        price,
        quantity: 1,
        variationId: variation?.id,
        variationName: variation?.name,
        image,
        warranty: product.warranty || "Standard Warranty",
        isSerialized: false,
        availableStock: available
      };
      return [newItem, ...prev];
    });

    setSearchQuery("");
    setSearchResults({ deviceUnits: [], products: [] });
    setVariationPicker(null);
  };

  /**
   * What a click on a product tile does. Anything with variations goes through
   * the picker — selling the base product when the stock sits on a variation
   * is how a sale ends up failing at settlement.
   */
  const handleProductClick = (product: PosProduct) => {
    if ((product.variations || []).length > 0) {
      setVariationPicker(product);
      return;
    }
    addProductToCart(product);
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item;
      if (item.isSerialized) return item; // Serialized items are strictly 1 unit

      const ceiling = item.availableStock ?? Infinity;
      const requested = item.quantity + delta;

      if (requested > ceiling) {
        notify.warning(`Only ${ceiling} of "${item.name}" in stock at this branch.`);
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
    setDiscountInput("");
    setCustomer(null);
    setCustomerPreBookings([]);
    setSelectedPreBooking(null);
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

  /**
   * Type-ahead over the customer book. Debounced, and the response is dropped
   * if the cashier has typed on since — otherwise a slow early request lands
   * after a fast later one and shows the wrong list.
   */
  useEffect(() => {
    if (!showCustomerModal || customerModalTab !== "find") return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const res = await fetch(
          `/api/v1/admin/pos/customers?q=${encodeURIComponent(customerSearch.trim())}`,
        );
        const json = await res.json();
        if (!cancelled && json.success) setCustomerResults(json.data.customers || []);
      } catch {
        if (!cancelled) setCustomerResults([]);
      } finally {
        if (!cancelled) setCustomerSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearch, showCustomerModal, customerModalTab]);

  /** Attach a customer to the sale, with whatever they have open at the till. */
  const selectCustomer = async (customerId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/pos/customers?id=${encodeURIComponent(customerId)}`);
      const json = await res.json();
      if (json.success && json.data?.customer) {
        applyCustomerLookup(json.data);
        setShowCustomerModal(false);
        setCustomerSearch("");
        setCustomerResults([]);
      } else {
        notify.error(json.error || "Could not load that customer.");
      }
    } catch {
      notify.error("Customer lookup failed");
    }
  };

  const openCustomerPicker = (tab: "find" | "new" = "find") => {
    setCustomerModalTab(tab);
    setShowCustomerModal(true);
  };

  const registerCustomer = async () => {
    if (!newCustomer.name.trim()) {
      notify.warning("Give the customer a name.");
      return;
    }
    if (!newCustomer.phone.trim()) {
      notify.warning("A contact number is required — it is how a due gets chased.");
      return;
    }

    setSavingCustomer(true);
    try {
      const res = await fetch("/api/v1/admin/pos/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email || null,
          credit_limit: newCustomer.credit_limit || 0,
        }),
      });
      const json = await res.json();

      if (json.success && json.data?.customer) {
        notify.success(
          json.data.already_registered
            ? `${json.data.customer.name} is already registered — attached to this sale.`
            : `${json.data.customer.name} registered as ${json.data.customer.customer_code}.`,
        );
        setNewCustomer({ name: "", phone: "", email: "", credit_limit: "" });
        await selectCustomer(json.data.customer.id);
      } else {
        notify.error(json.error || "Could not register that customer");
      }
    } catch {
      notify.error("Could not register that customer");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Calculations
  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  // A percentage is resolved against the subtotal here; the invoice, the
  // ledger and the API only ever see the taka figure it came to.
  const discountPercent =
    discountMode === "percent" ? Math.min(100, Math.max(0, Number(discountInput) || 0)) : 0;
  const discount = resolveDiscount(subtotal, discountMode, discountInput);
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
      notify.warning("Open a register shift before taking payment.");
      setShowOpenShiftModal(true);
      return;
    }
    if (cart.length === 0) {
      notify.warning("Cart is empty.");
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
      notify.warning(
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
      notify.warning(
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
        notify.warning(
          `That due takes ${customer.name} to ${fmt(projected)}, over their ${fmt(customer.credit_limit || 0)} credit limit.`
        );
        return;
      }
    }

    if (cashLineTotal > 0 && cashGiven > 0 && cashGiven < cashLineTotal) {
      notify.warning(`Cash received ${fmt(cashGiven)} is less than the ${fmt(cashLineTotal)} cash line.`);
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
          variation_id: i.variationId || null,
          variation_name: i.variationName || null,
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
        setDiscountInput("");
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

        // The sale just moved stock and changed what sold last here, so the
        // counter list the next customer sees is rebuilt rather than left
        // showing the shelf as it was before this ticket.
        loadCatalog();
      } else {
        notify.error("Checkout failed: " + (json.error || "Unknown error"));
      }
    } catch (err: any) {
      notify.error("Error processing checkout: " + err.message);
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
                    {(searchResults.products as PosProduct[]).map(prod => (
                      <ProductRow key={prod.id} product={prod} onSelect={handleProductClick} />
                    ))}
                  </div>
                )}

                {searchResults.deviceUnits.length === 0 && searchResults.products.length === 0 && !isSearching && (
                  <div className="py-12 text-center text-zinc-400 text-sm">
                    No items matching &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-5">
                {catalogLoading &&
                  catalog.recent.length === 0 &&
                  catalog.top.length === 0 &&
                  catalog.browse.length === 0 && (
                    <div className="py-16 text-center text-zinc-400 text-sm font-semibold">
                      Loading this branch&rsquo;s counter list…
                    </div>
                  )}

                {catalog.recent.length > 0 && (
                  <ProductStrip
                    title="Last sold here"
                    hint="Most recent sales at this branch"
                    products={catalog.recent}
                    onSelect={handleProductClick}
                  />
                )}

                {catalog.top.length > 0 && (
                  <ProductStrip
                    title="Most sold here"
                    hint={`Top sellers over the last ${catalog.top_seller_window_days} days`}
                    products={catalog.top}
                    onSelect={handleProductClick}
                  />
                )}

                {catalog.browse.length > 0 && (
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                        In stock at this branch
                      </p>
                      <span className="text-[10px] text-zinc-400 font-semibold">
                        {catalog.browse.length} products
                      </span>
                    </div>
                    <div className="space-y-2">
                      {catalog.browse.map(prod => (
                        <ProductRow key={prod.id} product={prod} onSelect={handleProductClick} />
                      ))}
                    </div>
                  </div>
                )}

                {!catalogLoading &&
                  catalog.recent.length === 0 &&
                  catalog.top.length === 0 &&
                  catalog.browse.length === 0 && (
                    <div className="py-16 text-center text-zinc-400">
                      <span className="text-4xl">🎯</span>
                      <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300 mt-2">Ready to Scan or Search</p>
                      <p className="text-xs text-zinc-500 mt-1">Scan any hardware barcode/IMEI with your scanner or type above.</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns: Customer & Active Ticket */}
        <div className="col-span-5 p-4 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Customer header */}
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
                    onClick={() => openCustomerPicker("find")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>👤</span>
                    Find Customer
                  </button>
                  {canRegisterCustomers && (
                    <button
                      onClick={() => openCustomerPicker("new")}
                      className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all"
                    >
                      + New Customer
                    </button>
                  )}
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
              <div className="flex items-center gap-1.5">
                {/* Flat taka or a percentage of the subtotal — the resolved
                    figure below is what the invoice carries either way. */}
                <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                  {(["amount", "percent"] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDiscountMode(mode)}
                      aria-pressed={discountMode === mode}
                      className={`px-2 py-1 text-xs font-extrabold transition-colors ${
                        discountMode === mode
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      {mode === "amount" ? "৳" : "%"}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  max={discountMode === "percent" ? 100 : undefined}
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  placeholder="0"
                  className="w-20 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-right text-xs font-bold text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>
                  {discountMode === "percent"
                    ? `Less ${discountPercent}% of ${fmt(subtotal)}`
                    : "Less discount"}
                </span>
                <span>− {fmt(discount)}</span>
              </div>
            )}

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
                    notify.error(json.error || "Failed to open shift");
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
                    notify.success(
                      `${variance}\n\n${
                        json.message ||
                        (isOwner ? "Drawer closed." : "Submitted for approval.")
                      }`,
                    );
                    setActiveShift(null);
                    setActualCashInput("");
                    setShowCloseShiftModal(false);
                  } else {
                    notify.error(json.error || "Failed to close shift");
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
                    notify.error(json.error || "Failed to record movement");
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

      {/* --- MODAL 6: Customer picker — find or register --- */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Customer</h2>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            {canRegisterCustomers && (
              <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {([
                  ["find", "Find existing"],
                  ["new", "Register new"],
                ] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCustomerModalTab(tab)}
                    aria-pressed={customerModalTab === tab}
                    className={`flex-1 py-2 text-xs font-extrabold transition-colors ${
                      customerModalTab === tab
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {customerModalTab === "find" || !canRegisterCustomers ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Phone / Name / Code
                  </label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Start typing a name or 017…"
                    autoFocus
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                {/* The list narrows as they type; nothing is attached to the
                    sale until a row is actually chosen. */}
                <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1.5">
                  {customerSearching && customerResults.length === 0 && (
                    <p className="py-6 text-center text-xs font-semibold text-zinc-400">Searching…</p>
                  )}

                  {!customerSearching && customerResults.length === 0 && (
                    <p className="py-6 text-center text-xs font-semibold text-zinc-400">
                      {customerSearch.trim()
                        ? `No customer matches “${customerSearch.trim()}”.`
                        : "No customers on file yet."}
                    </p>
                  )}

                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c.id)}
                      className="w-full text-left p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white truncate">{c.name}</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono text-[10px] rounded font-bold shrink-0">
                          {c.customer_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                        <span className="font-mono">{c.phone || "no phone"}</span>
                        {Number(c.advance_balance) > 0 && (
                          <span className="text-emerald-600 font-bold">Advance {fmt(Number(c.advance_balance))}</span>
                        )}
                        {Number(c.outstanding_due) > 0 && (
                          <span className="text-rose-600 font-bold">Due {fmt(Number(c.outstanding_due))}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Full name</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="e.g. Rahim Uddin"
                    autoFocus
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="017…"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Credit limit</label>
                    <input
                      type="number"
                      min={0}
                      value={newCustomer.credit_limit}
                      onChange={e => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-right text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Email <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <p className="text-[11px] text-zinc-500 leading-snug">
                  A phone number already on file attaches that customer to this sale instead of
                  creating a second record.
                </p>

                <button
                  onClick={registerCustomer}
                  disabled={savingCustomer}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all"
                >
                  {savingCustomer ? "Registering…" : "Register & attach to sale"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 7: Variation picker --- */}
      {variationPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ProductThumb src={firstImage(variationPicker.images)} name={variationPicker.name} />
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-zinc-900 dark:text-white truncate">
                    {variationPicker.name}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono">Pick what is going out</p>
                </div>
              </div>
              <button
                onClick={() => setVariationPicker(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {/* The base product only appears when the branch holds pooled
                  stock for it — that is the only row it can sell against. */}
              {variationPicker.available_quantity > 0 && (
                <button
                  type="button"
                  onClick={() => addProductToCart(variationPicker)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 text-left transition-all"
                >
                  <ProductThumb
                    src={firstImage(variationPicker.images)}
                    name={variationPicker.name}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white">Base product</p>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">
                      SKU: {variationPicker.sku || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-sm text-zinc-900 dark:text-white">
                      {fmt(variationPicker.base_price)}
                    </p>
                    <StockBadge available={variationPicker.available_quantity} />
                  </div>
                </button>
              )}

              {variationPicker.variations.map(variation => {
                const available = Number(variation.available_quantity ?? 0);
                const sellable = available > 0;

                return (
                  <button
                    key={variation.id}
                    type="button"
                    onClick={() => addProductToCart(variationPicker, variation)}
                    disabled={!sellable}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      sellable
                        ? "border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20"
                        : "border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/60 dark:bg-zinc-800/20 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <ProductThumb
                      src={firstImage(variation.images) || firstImage(variationPicker.images)}
                      name={variation.name}
                      className="h-10 w-10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                        {variation.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono truncate">
                        SKU: {variation.sku || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-sm text-zinc-900 dark:text-white">
                        {fmt(variation.price)}
                      </p>
                      <StockBadge available={available} />
                    </div>
                  </button>
                );
              })}

              {variationPicker.available_quantity <= 0 &&
                variationPicker.variations.every(v => v.available_quantity <= 0) && (
                  <p className="py-8 text-center text-xs font-semibold text-zinc-400">
                    Nothing on this product is in stock at this branch.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
