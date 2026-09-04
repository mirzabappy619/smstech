"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttributeDefinition {
  id?: string;
  name: string;
  displayName: string;
  values: string[];
  displayOrder: number;
}

interface UnitSystem {
  baseUnit: "piece" | "pair" | "dozen" | "pack";
  unitsPerPackage: number;
  packageName: string;
}

interface ProductVariation {
  id: string;
  name: string;
  sku: string;
  price: number;
  attributes: Record<string, string>;
  is_active: boolean;
  is_auto_generated?: boolean;
  images?: string[];
  total_available?: number;
  total_quantity?: number;
  total_reserved?: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  base_price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  weight: number | null;
  is_active: boolean;
  is_featured: boolean;
  is_digital: boolean;
  track_inventory: boolean;
  is_preorder: boolean;
  preorder_release_date: string | null;
  preorder_deposit_pct: number | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | string[] | null;
  images: string[];
  variations: ProductVariation[];
  metadata: { brand?: string | null; trust_badges?: { icon: string; text: string }[] } | null;
  unit_system?: UnitSystem | null;
  attribute_definitions?: AttributeDefinition[] | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockPill({ available, total }: { available?: number; total?: number }) {
  if (available === undefined) return null;
  const color =
    available <= 0
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : available <= 10
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {available <= 0 ? "Out of stock" : available <= 10 ? "Low stock" : "In stock"}
      {total !== undefined && <span className="opacity-60 ml-1">({available}/{total})</span>}
    </span>
  );
}

function AttrChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
      <span className="opacity-60">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageError, setImageError] = useState("");
  const [variationImageUrlInput, setVariationImageUrlInput] = useState<Record<string, string>>({});
  const [uploadingVariationIdx, setUploadingVariationIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "variations" | "media" | "seo" | "trust_badges">("basic");

  // Core form state
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    short_description: "",
    category_id: "",
    brand: "",
    base_price: "",
    compare_at_price: "",
    cost_price: "",
    sku: "",
    barcode: "",
    weight: "",
    is_active: true,
    is_featured: false,
    is_digital: false,
    track_inventory: false,
    is_preorder: false,
    preorder_release_date: "",
    preorder_deposit_pct: "10",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [trustBadges, setTrustBadges] = useState<{ icon: string; text: string }[]>([]);
  const [newBadgeIcon, setNewBadgeIcon] = useState("truck");
  const [newBadgeText, setNewBadgeText] = useState("");

  // Variation system
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>({
    baseUnit: "piece",
    unitsPerPackage: 1,
    packageName: "Individual",
  });

  // Attribute builder UI state
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrDisplayName, setNewAttrDisplayName] = useState("");
  const [newAttrValuesInput, setNewAttrValuesInput] = useState("");
  const [attrError, setAttrError] = useState("");
  const [expandedAttr, setExpandedAttr] = useState<string | null>(null);
  const [editAttrValues, setEditAttrValues] = useState("");

  // Variation expand state
  const [expandedVar, setExpandedVar] = useState<string | null>(null);

  // File input refs for variations
  const variationFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const TRUST_BADGE_ICONS = [
    { value: "truck", label: "Truck (Shipping)" },
    { value: "shield", label: "Shield (Warranty/Security)" },
    { value: "rotate-ccw", label: "Rotate (Returns)" },
    { value: "zap", label: "Lightning (Fast Delivery)" },
    { value: "check", label: "Check (Verified)" },
    { value: "heart", label: "Heart (Guarantee)" },
    { value: "star", label: "Star (Rating)" },
  ];

  function cap(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
  }

  // ── Image handlers ─────────────────────────────────────────────────────────

  const addImageUrl = () => {
    const trimmedUrl = imageUrlInput.trim();
    if (!trimmedUrl) { setImageError("Enter an image URL to add"); return; }
    try {
      const p = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(p.protocol)) throw new Error("bad protocol");
    } catch {
      setImageError("Enter a valid image URL"); return;
    }
    setImages((prev) => Array.from(new Set([...prev, trimmedUrl])));
    setImageUrlInput("");
    setImageError("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsUploadingImages(true);
    setImageError("");
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("bucket", "products");
          fd.append("folder", formData.slug || productId);
          const res = await fetch("/api/v1/storage/upload", { method: "POST", body: fd });
          const raw = await res.text();
          let result: { success?: boolean; data?: { publicUrl?: string }; publicUrl?: string; error?: { message?: string } } | null = null;
          try { result = JSON.parse(raw); } catch { result = null; }
          if (!res.ok) throw new Error(result?.error?.message || `Failed to upload ${file.name}`);
          const url = result?.data?.publicUrl || result?.publicUrl;
          if (!url) throw new Error(`No URL returned for ${file.name}`);
          return url;
        }),
      );
      setImages((prev) => Array.from(new Set([...prev, ...urls])));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingImages(false);
      e.target.value = "";
    }
  };

  const addVariationImageUrl = (variationIdx: number) => {
    const key = `var-${variationIdx}`;
    const trimmedUrl = variationImageUrlInput[key]?.trim() || "";
    if (!trimmedUrl) { setImageError("Enter an image URL to add"); return; }
    try {
      const p = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(p.protocol)) throw new Error("bad protocol");
    } catch {
      setImageError("Enter a valid image URL"); return;
    }
    updateVariation(variationIdx, "images",
      Array.from(new Set([...(variations[variationIdx]?.images || []), trimmedUrl]))
    );
    setVariationImageUrlInput((prev) => ({ ...prev, [key]: "" }));
    setImageError("");
  };

  const triggerVariationImageUpload = (variationIdx: number) => {
    variationFileInputRefs.current[variationIdx]?.click();
  };

  const handleVariationImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    variationIdx: number,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingVariationIdx(variationIdx);
    setImageError("");
    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("bucket", "products");
          fd.append("folder", formData.slug || productId);
          const res = await fetch("/api/v1/storage/upload", { method: "POST", body: fd });
          const raw = await res.text();
          let result: { success?: boolean; data?: { publicUrl?: string }; publicUrl?: string; error?: { message?: string } } | null = null;
          try { result = JSON.parse(raw); } catch { result = null; }
          if (!res.ok) throw new Error(result?.error?.message || `Failed to upload ${file.name}`);
          const url = result?.data?.publicUrl || result?.publicUrl;
          if (!url) throw new Error(`No URL returned for ${file.name}`);
          return url;
        }),
      );
      updateVariation(variationIdx, "images",
        Array.from(new Set([...(variations[variationIdx]?.images || []), ...uploadedUrls.filter(Boolean)]))
      );
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingVariationIdx(null);
      e.target.value = "";
    }
  };

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCategories();
    fetchProduct();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProduct = async () => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/v1/admin/products/${productId}`);
      const data = await res.json();
      if (data.success) {
        const p = data.data as Product;
        setFormData({
          name: p.name || "",
          slug: p.slug || "",
          description: p.description || "",
          short_description: p.short_description || "",
          category_id: p.category_id || "",
          brand: p.metadata?.brand || "",
          base_price: p.base_price?.toString() || "",
          compare_at_price: p.compare_at_price?.toString() || "",
          cost_price: p.cost_price?.toString() || "",
          sku: p.sku || "",
          barcode: p.barcode || "",
          weight: p.weight?.toString() || "",
          is_active: p.is_active ?? true,
          is_featured: p.is_featured ?? false,
          is_digital: p.is_digital ?? false,
          track_inventory: p.track_inventory ?? false,
          is_preorder: p.is_preorder ?? false,
          preorder_release_date: p.preorder_release_date || "",
          preorder_deposit_pct: (p.preorder_deposit_pct ?? 10).toString(),
          seo_title: p.seo_title || "",
          seo_description: p.seo_description || "",
          seo_keywords: Array.isArray(p.seo_keywords) ? p.seo_keywords.join(", ") : (p.seo_keywords || ""),
        });
        setVariations(p.variations || []);
        setImages(p.images || []);
        const meta = p.metadata as Record<string, unknown> | null;
        setTrustBadges(Array.isArray(meta?.trust_badges) ? (meta.trust_badges as { icon: string; text: string }[]) : []);
        if (p.attribute_definitions?.length) setAttributeDefinitions(p.attribute_definitions);
        if (p.unit_system) setUnitSystem(p.unit_system);
      } else {
        alert("Failed to load product.");
        router.push("/admin/products");
      }
    } catch {
      alert("Failed to load product.");
      router.push("/admin/products");
    } finally {
      setIsFetching(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/categories");
      const data = await res.json();
      if (data.success) setCategories(data.data || []);
    } catch { /* silent */ }
    setCategoriesLoading(false);
  };

  // ── Form helpers ───────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const generateSlug = () => {
    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    setFormData((prev) => ({ ...prev, slug }));
  };

  // ── Variation CRUD ─────────────────────────────────────────────────────────

  const addVariation = () => {
    const v: ProductVariation = {
      id: `temp-${Date.now()}`,
      name: "",
      sku: `${formData.sku || "VAR"}-${String(variations.length + 1).padStart(3, "0")}`,
      price: parseFloat(formData.base_price) || 0,
      attributes: {},
      is_active: true,
      is_auto_generated: false,
    };
    setVariations((prev) => [...prev, v]);
    setExpandedVar(v.id);
  };

  const updateVariation = (idx: number, field: keyof ProductVariation, value: unknown) => {
    setVariations((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removeVariation = (idx: number) => setVariations((prev) => prev.filter((_, i) => i !== idx));

  // ── Attribute Definitions ──────────────────────────────────────────────────

  const addAttr = () => {
    setAttrError("");
    const name = newAttrName.trim().toLowerCase();
    const displayName = newAttrDisplayName.trim() || cap(name);
    if (!name) { setAttrError("Attribute key is required"); return; }
    if (attributeDefinitions.some((a) => a.name === name)) { setAttrError(`"${name}" already exists`); return; }
    const values = newAttrValuesInput.split(",").map((v) => v.trim()).filter(Boolean);
    if (!values.length) { setAttrError("Add at least one value"); return; }
    setAttributeDefinitions((prev) => [...prev, { name, displayName, values, displayOrder: prev.length }]);
    setNewAttrName(""); setNewAttrDisplayName(""); setNewAttrValuesInput("");
  };

  const removeAttr = (name: string) => setAttributeDefinitions((prev) => prev.filter((a) => a.name !== name));

  const toggleEditAttr = (attr: AttributeDefinition) => {
    if (expandedAttr === attr.name) { setExpandedAttr(null); return; }
    setExpandedAttr(attr.name);
    setEditAttrValues(attr.values.join(", "));
  };

  const saveAttrEdit = (name: string) => {
    const values = editAttrValues.split(",").map((v) => v.trim()).filter(Boolean);
    if (!values.length) return;
    setAttributeDefinitions((prev) => prev.map((a) => a.name === name ? { ...a, values } : a));
    setExpandedAttr(null);
  };

  // ── Auto-generate Combinations ─────────────────────────────────────────────

  const autoGenerate = () => {
    if (!attributeDefinitions.length) return;
    const combos: Record<string, string>[] = [];
    const gen = (attrs: AttributeDefinition[], cur: Record<string, string> = {}, idx = 0): void => {
      if (idx === attrs.length) { combos.push({ ...cur }); return; }
      attrs[idx].values.forEach((v) => gen(attrs, { ...cur, [attrs[idx].name]: v }, idx + 1));
    };
    gen(attributeDefinitions);

    const baseSku = formData.sku || "VAR";
    const basePrice = parseFloat(formData.base_price) || 0;
    const manual = variations.filter((v) => !v.is_auto_generated);

    const generated: ProductVariation[] = combos.map((combo, idx) => {
      const existing = variations.find((v) =>
        v.is_auto_generated && Object.entries(combo).every(([k, val]) => v.attributes[k] === val)
      );
      const comboLabel = Object.values(combo).join("-");
      return {
        id: existing?.id ?? `auto-${Date.now()}-${idx}`,
        name: Object.values(combo).join(" / "),
        sku: existing?.sku ?? `${baseSku}-${comboLabel.toUpperCase().replace(/\s+/g, "")}`,
        price: existing?.price ?? basePrice,
        attributes: combo,
        is_active: existing?.is_active ?? true,
        is_auto_generated: true,
        total_available: existing?.total_available,
        total_quantity: existing?.total_quantity,
        total_reserved: existing?.total_reserved,
      };
    });

    setVariations([...manual, ...generated]);
  };

  const comboCounts = attributeDefinitions.reduce((acc, a) => (acc === 0 ? a.values.length : acc * a.values.length), 0);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        category_id: formData.category_id || undefined,
        seo_keywords: Array.isArray(formData.seo_keywords)
          ? (formData.seo_keywords as unknown as string[]).join(", ")
          : formData.seo_keywords,
        base_price: parseFloat(formData.base_price) || 0,
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        preorder_release_date: formData.preorder_release_date || null,
        preorder_deposit_pct: parseFloat(formData.preorder_deposit_pct) || 10,
        variations: variations.map((v) => ({
          id: v.id.startsWith("temp-") || v.id.startsWith("auto-") ? undefined : v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          attributes: v.attributes,
          is_active: v.is_active,
          is_auto_generated: v.is_auto_generated ?? false,
        })),
        images,
        trust_badges: trustBadges,
        attribute_definitions: attributeDefinitions,
        unit_system: unitSystem,
      };

      const res = await fetch(`/api/v1/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Failed to update product");
      }

      alert("Product updated successfully!");
      router.push("/admin/products");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update product.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-zinc-600 dark:text-zinc-400">Loading product...</p>
        </div>
      </div>
    );
  }

  // ── Shared style shortcuts ─────────────────────────────────────────────────
  const input = "w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm";
  const lbl = "block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1";
  const card = "bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Edit Product</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Update product information</p>
        </div>
        <Link href="/admin/products" className="px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
          Cancel
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-zinc-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {[
            { id: "basic", label: "Basic Info" },
            { id: "variations", label: `Variations${variations.length > 0 ? ` (${variations.length})` : ""}` },
            { id: "media", label: "Media" },
            { id: "seo", label: "SEO" },
            { id: "trust_badges", label: "Trust Badges" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-gray-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Basic Info ───────────────────────────────────────────────────── */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Product Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className={lbl}>Product Name *</label>
                  <div className="flex gap-2">
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" placeholder="Enter product name" />
                    <button type="button" onClick={generateSlug} className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">Generate Slug</button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>Slug *</label>
                  <input type="text" name="slug" value={formData.slug} onChange={handleInputChange} required className={input} placeholder="product-url-slug" />
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>Short Description</label>
                  <input type="text" name="short_description" value={formData.short_description} onChange={handleInputChange} className={input} placeholder="Brief product description" />
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>Full Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} className={input} placeholder="Detailed product description" />
                </div>
                <div>
                  <label className={lbl}>Category *</label>
                  <select name="category_id" value={formData.category_id} onChange={handleInputChange} required disabled={categoriesLoading} className={`${input} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <option value="">Select a category</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Brand</label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className={input} placeholder="Brand name" />
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={lbl}>Base Price * (৳)</label>
                  <input type="number" name="base_price" value={formData.base_price} onChange={handleInputChange} required step="0.01" min="0" className={input} placeholder="0.00" />
                </div>
                <div>
                  <label className={lbl}>Compare At Price (৳)</label>
                  <input type="number" name="compare_at_price" value={formData.compare_at_price} onChange={handleInputChange} step="0.01" min="0" className={input} placeholder="0.00" />
                </div>
                <div>
                  <label className={lbl}>Cost Price (৳)</label>
                  <input type="number" name="cost_price" value={formData.cost_price} onChange={handleInputChange} step="0.01" min="0" className={input} placeholder="0.00" />
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Inventory</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={lbl}>SKU</label>
                  <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className={input} placeholder="SKU-001" />
                </div>
                <div>
                  <label className={lbl}>Barcode</label>
                  <input type="text" name="barcode" value={formData.barcode} onChange={handleInputChange} className={input} placeholder="123456789" />
                </div>
                <div>
                  <label className={lbl}>Weight (kg)</label>
                  <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} step="0.01" min="0" className={input} placeholder="0.00" />
                </div>
              </div>
            </div>

            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Status</h2>
              <div className="space-y-4">
                {[
                  { name: "is_active", label: "Active (visible to customers)" },
                  { name: "is_featured", label: "Featured product" },
                  { name: "is_digital", label: "Digital product (no shipping required)" },
                ].map((cb) => (
                  <label key={cb.name} className="flex items-center">
                    <input type="checkbox" name={cb.name} checked={formData[cb.name as keyof typeof formData] as boolean} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <span className="ml-2 text-sm text-zinc-900 dark:text-zinc-100">{cb.label}</span>
                  </label>
                ))}

                {/* Track inventory toggle */}
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-zinc-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Track Inventory / Block Out-of-Stock Orders</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        When enabled, customers cannot add or order variations with 0 available stock.
                        The buttons will be greyed out and a notification will be shown.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.track_inventory}
                      onClick={() => setFormData((prev) => ({ ...prev, track_inventory: !prev.track_inventory }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        formData.track_inventory ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-600"
                      }`}>
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                          formData.track_inventory ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {formData.track_inventory && (
                    <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                      ✓ Out-of-stock orders are blocked for this product
                    </p>
                  )}
                </div>

                {/* Pre-order toggle */}
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-zinc-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pre-Order Only</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Hides Add to Cart and Buy Now on the storefront. Customers reserve a queue slot
                        with a deposit instead, and the booking appears under Pre-Bookings for allocation.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.is_preorder}
                      onClick={() => setFormData((prev) => ({ ...prev, is_preorder: !prev.is_preorder }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        formData.is_preorder ? "bg-amber-500" : "bg-gray-200 dark:bg-zinc-600"
                      }`}>
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                          formData.is_preorder ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {formData.is_preorder && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className={lbl}>Expected Release Date</label>
                        <input
                          type="date"
                          name="preorder_release_date"
                          value={formData.preorder_release_date}
                          onChange={handleInputChange}
                          className={input}
                        />
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Optional. Shown to customers on the product page.</p>
                      </div>
                      <div>
                        <label className={lbl}>Deposit Required (%)</label>
                        <input
                          type="number"
                          name="preorder_deposit_pct"
                          value={formData.preorder_deposit_pct}
                          onChange={handleInputChange}
                          step="0.5"
                          min="0.5"
                          max="100"
                          className={input}
                        />
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Advance paid to hold a queue slot. 100% = full prepayment.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Variations Tab ───────────────────────────────────────────────── */}
        {activeTab === "variations" && (
          <div className="space-y-6">

            {/* Unit System */}
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Unit System</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                How is this product measured? Determines how package quantities translate to individual units.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Base Unit</label>
                  <select value={unitSystem.baseUnit} onChange={(e) => setUnitSystem((u) => ({ ...u, baseUnit: e.target.value as UnitSystem["baseUnit"] }))} className={input}>
                    {(["piece", "pair", "dozen", "pack"] as const).map((u) => (
                      <option key={u} value={u}>{cap(u)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Units per Package</label>
                  <input type="number" min={1} value={unitSystem.unitsPerPackage} onChange={(e) => setUnitSystem((u) => ({ ...u, unitsPerPackage: parseInt(e.target.value) || 1 }))} className={input} />
                </div>
                <div>
                  <label className={lbl}>Package Name</label>
                  <input type="text" value={unitSystem.packageName} onChange={(e) => setUnitSystem((u) => ({ ...u, packageName: e.target.value }))} className={input} placeholder="e.g. Box, Set, Bundle" />
                </div>
              </div>
            </div>

            {/* Attribute Definitions */}
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Attribute Definitions</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Define variation axes (e.g. Color, Size). Use <strong>Auto-Generate</strong> below to create all combinations automatically.
              </p>

              {/* Existing definitions */}
              {attributeDefinitions.length > 0 && (
                <div className="space-y-2 mb-5">
                  {attributeDefinitions.map((attr) => (
                    <div key={attr.name} className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-700/40">
                        <div className="flex items-center gap-3 flex-wrap min-w-0">
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{attr.displayName}</span>
                          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">({attr.name})</span>
                          <div className="flex flex-wrap gap-1">
                            {attr.values.map((v) => (
                              <span key={v} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{v}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-3">
                          <button type="button" onClick={() => toggleEditAttr(attr)} className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-500">
                            {expandedAttr === attr.name ? "Cancel" : "Edit"}
                          </button>
                          <button type="button" onClick={() => removeAttr(attr.name)} className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100">
                            Remove
                          </button>
                        </div>
                      </div>
                      {expandedAttr === attr.name && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-zinc-700 flex gap-2">
                          <input type="text" value={editAttrValues} onChange={(e) => setEditAttrValues(e.target.value)} className={`${input} flex-1`} placeholder="Comma-separated values, e.g. Red, Blue, Green" />
                          <button type="button" onClick={() => saveAttrEdit(attr.name)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new attribute */}
              <div className="border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg p-4">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Add New Attribute</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Key (internal, lowercase)</label>
                    <input
                      type="text"
                      value={newAttrName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewAttrName(v);
                        if (!newAttrDisplayName || newAttrDisplayName === cap(newAttrName)) setNewAttrDisplayName(cap(v));
                      }}
                      className={input}
                      placeholder="e.g. color"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Display Name</label>
                    <input type="text" value={newAttrDisplayName} onChange={(e) => setNewAttrDisplayName(e.target.value)} className={input} placeholder="e.g. Color" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Values (comma-separated)</label>
                    <input type="text" value={newAttrValuesInput} onChange={(e) => setNewAttrValuesInput(e.target.value)} className={input} placeholder="Red, Blue, Green" />
                  </div>
                </div>
                {attrError && <p className="text-xs text-red-600 mb-2">{attrError}</p>}
                <button type="button" onClick={addAttr} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  + Add Attribute
                </button>
              </div>
            </div>

            {/* Variations list */}
            <div className={card}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Product Variations</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {variations.length === 0
                      ? "No variations yet. Add attributes above, then auto-generate — or add manually."
                      : `${variations.length} variation${variations.length !== 1 ? "s" : ""} · ${variations.filter((v) => v.is_auto_generated).length} auto-generated`}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {attributeDefinitions.length > 0 && comboCounts > 0 && (
                    <button
                      type="button"
                      onClick={autoGenerate}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Auto-Generate ({comboCounts})
                    </button>
                  )}
                  <button type="button" onClick={addVariation} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    + Manual
                  </button>
                </div>
              </div>

              {variations.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl">
                  <div className="text-5xl mb-3">🎨</div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No variations yet</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                    Define attributes above, then click Auto-Generate to create all combinations — or add them manually.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Column headers (desktop) */}
                  <div className="hidden md:grid md:grid-cols-[2fr_150px_110px_130px_70px_60px] gap-3 px-4 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-700">
                    <span>Variation</span>
                    <span>SKU</span>
                    <span>Price</span>
                    <span>Stock</span>
                    <span>Active</span>
                    <span></span>
                  </div>

                  {variations.map((variation, index) => (
                    <div
                      key={variation.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        variation.is_auto_generated
                          ? "border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/10"
                          : "border-gray-200 dark:border-zinc-700"
                      }`}>
                      {/* Summary row */}
                      <div
                        className="grid grid-cols-1 md:grid-cols-[2fr_150px_110px_130px_70px_60px] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-white/70 dark:hover:bg-zinc-700/30 transition-colors"
                        onClick={() => setExpandedVar(expandedVar === variation.id ? null : variation.id)}>

                        {/* Name + attributes */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {variation.is_auto_generated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                Auto
                              </span>
                            )}
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {variation.name || <span className="text-zinc-400 italic font-normal">Unnamed</span>}
                            </span>
                          </div>
                          {Object.keys(variation.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variation.attributes).map(([k, v]) => (
                                <AttrChip key={k} label={k} value={v} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SKU */}
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate hidden md:block">{variation.sku || "—"}</span>

                        {/* Price — inline editable */}
                        <div className="hidden md:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-zinc-400">৳</span>
                          <input
                            type="number"
                            value={variation.price}
                            onChange={(e) => updateVariation(index, "price", parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            className="w-20 px-1.5 py-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-500 rounded focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-700 focus:outline-none transition-colors"
                          />
                        </div>

                        {/* Stock */}
                        <div className="hidden md:block">
                          {variation.total_available !== undefined
                            ? <StockPill available={variation.total_available} total={variation.total_quantity} />
                            : <span className="text-xs text-zinc-400">Not tracked</span>}
                        </div>

                        {/* Active toggle */}
                        <div className="hidden md:flex items-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={variation.is_active}
                            onChange={(e) => updateVariation(index, "is_active", e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => removeVariation(index)}
                            title="Remove variation"
                            className="text-zinc-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedVar(expandedVar === variation.id ? null : variation.id)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded">
                            <svg className={`w-4 h-4 transition-transform ${expandedVar === variation.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded edit form */}
                      {expandedVar === variation.id && (
                        <div className="border-t border-gray-100 dark:border-zinc-700 px-4 py-4 bg-white/50 dark:bg-zinc-800/40">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className={lbl}>Variation Name</label>
                              <input
                                type="text"
                                value={variation.name}
                                onChange={(e) => updateVariation(index, "name", e.target.value)}
                                className={input}
                                placeholder="e.g. Large Blue"
                              />
                            </div>
                            <div>
                              <label className={lbl}>SKU *</label>
                              <input
                                type="text"
                                value={variation.sku}
                                onChange={(e) => updateVariation(index, "sku", e.target.value)}
                                className={input}
                                placeholder="SKU-VAR-001"
                              />
                            </div>
                            <div>
                              <label className={lbl}>Price (৳)</label>
                              <input
                                type="number"
                                value={variation.price}
                                onChange={(e) => updateVariation(index, "price", parseFloat(e.target.value) || 0)}
                                step="0.01"
                                min="0"
                                className={input}
                                placeholder="0.00"
                              />
                            </div>

                            {/* Per-attribute selectors */}
                            {attributeDefinitions.map((attr) => (
                              <div key={attr.name}>
                                <label className={lbl}>{attr.displayName}</label>
                                <select
                                  value={variation.attributes[attr.name] || ""}
                                  onChange={(e) =>
                                    updateVariation(index, "attributes", {
                                      ...variation.attributes,
                                      [attr.name]: e.target.value,
                                    })
                                  }
                                  className={input}>
                                  <option value="">— none —</option>
                                  {attr.values.map((v) => <option key={v} value={v}>{v}</option>)}
                                </select>
                              </div>
                            ))}

                            {/* Stock read-only display */}
                            {variation.total_quantity !== undefined && (
                              <div className="sm:col-span-2 md:col-span-3 p-3 rounded-lg bg-gray-50 dark:bg-zinc-700/30 border border-gray-200 dark:border-zinc-700">
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                                  Warehouse Stock (read-only)
                                </p>
                                <div className="flex gap-6">
                                  {[
                                    { l: "Total", v: variation.total_quantity, cl: "text-zinc-900 dark:text-zinc-100" },
                                    { l: "Reserved", v: variation.total_reserved, cl: "text-amber-600" },
                                    { l: "Available", v: variation.total_available, cl: "text-emerald-600" },
                                  ].map(({ l, v, cl }) => (
                                    <div key={l} className="text-center">
                                      <p className={`text-xl font-bold ${cl}`}>{v ?? 0}</p>
                                      <p className="text-xs text-zinc-500">{l}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Active toggle (mobile accessible) */}
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`active-${variation.id}`}
                                checked={variation.is_active}
                                onChange={(e) => updateVariation(index, "is_active", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label htmlFor={`active-${variation.id}`} className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                Active
                              </label>
                            </div>
                          </div>

                          {/* Variation Images */}
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-700">
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                              Variation Images
                            </p>
                            {(variation.images || []).length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                {variation.images?.map((img, imgIdx) => (
                                  <div key={imgIdx} className="relative group">
                                    <div className="aspect-square bg-gray-100 dark:bg-zinc-700 rounded-lg overflow-hidden">
                                      <img
                                        src={img}
                                        alt={`Variation image ${imgIdx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateVariation(
                                        index,
                                        "images",
                                        (variation.images || []).filter((_, i) => i !== imgIdx)
                                      )}
                                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => triggerVariationImageUpload(index)}
                                disabled={uploadingVariationIdx === index}
                                className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-600 transition text-zinc-600 dark:text-zinc-300 flex items-center justify-center gap-1.5 disabled:opacity-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Upload Image
                              </button>
                              <input
                                ref={(el) => {
                                  if (el) variationFileInputRefs.current[index] = el;
                                }}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => handleVariationImageUpload(e, index)}
                                className="hidden"
                              />
                            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                placeholder="Or paste image URL..."
                                value={variationImageUrlInput[`var-${index}`] || ""}
                                onChange={(e) => setVariationImageUrlInput((prev) => ({ ...prev, [`var-${index}`]: e.target.value }))}
                                className={input}
                              />
                              <button
                                type="button"
                                onClick={() => addVariationImageUrl(index)}
                                disabled={uploadingVariationIdx === index}
                                className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50">
                                Add
                              </button>
                            </div>
                            {uploadingVariationIdx === index && (
                              <p className="text-xs text-blue-500 mt-2">Uploading...</p>
                            )}
                          </div>

                          {/* Warehouse link */}
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-700">
                            <Link
                              href={`/admin/inventory/warehouse?variation_id=${variation.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                              Manage warehouse stock for this variation →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Media ────────────────────────────────────────────────────────── */}
        {activeTab === "media" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Product Images</h2>
              <div className="space-y-4">
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative aspect-square border border-gray-300 dark:border-zinc-600 rounded-lg overflow-hidden">
                        <img src={image} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Upload images</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Upload product images to the Supabase products bucket</p>
                  <input type="file" multiple accept="image/*" className="hidden" id="edit-image-upload" onChange={handleImageUpload} />
                  <label htmlFor="edit-image-upload" className={`mt-4 inline-block px-4 py-2 text-sm font-medium rounded-lg cursor-pointer ${isUploadingImages ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "text-blue-600 bg-blue-50 hover:bg-blue-100"}`}>
                    {isUploadingImages ? "Uploading..." : "Choose Files"}
                  </label>
                </div>
                <div>
                  <label className={lbl}>Add Image URL</label>
                  <div className="flex gap-2">
                    <input type="url" value={imageUrlInput} onChange={(e) => { setImageUrlInput(e.target.value); if (imageError) setImageError(""); }} className={`${input} flex-1`} placeholder="https://example.com/image.jpg" />
                    <button type="button" onClick={addImageUrl} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Add Link</button>
                  </div>
                  {imageError && <p className="mt-3 text-sm text-red-600">{imageError}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SEO ──────────────────────────────────────────────────────────── */}
        {activeTab === "seo" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">SEO Information</h2>
              <div className="space-y-4">
                <div>
                  <label className={lbl}>SEO Title</label>
                  <input type="text" name="seo_title" value={formData.seo_title} onChange={handleInputChange} className={input} placeholder="SEO-optimized title" />
                </div>
                <div>
                  <label className={lbl}>SEO Description</label>
                  <textarea name="seo_description" value={formData.seo_description} onChange={handleInputChange} rows={3} className={input} placeholder="Meta description for search engines" />
                </div>
                <div>
                  <label className={lbl}>SEO Keywords</label>
                  <input type="text" name="seo_keywords" value={formData.seo_keywords} onChange={handleInputChange} className={input} placeholder="keyword1, keyword2, keyword3" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Trust Badges ─────────────────────────────────────────────────── */}
        {activeTab === "trust_badges" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">Trust Badges</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Add trust signals shown on the product page (e.g. Free Shipping, Warranty, Returns).</p>
              {trustBadges.length > 0 && (
                <div className="space-y-2 mb-6">
                  {trustBadges.map((badge, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-zinc-600 rounded-lg">
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 w-28 text-center flex-shrink-0">{badge.icon}</span>
                      <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">{badge.text}</span>
                      <button type="button" onClick={() => setTrustBadges((prev) => prev.filter((_, i) => i !== index))} className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Add a badge</p>
                <div className="flex gap-3 flex-wrap">
                  <select value={newBadgeIcon} onChange={(e) => setNewBadgeIcon(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                    {TRUST_BADGE_ICONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <input type="text" value={newBadgeText} onChange={(e) => setNewBadgeText(e.target.value)} placeholder="Badge text (e.g. Free Shipping)" className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" />
                  <button type="button" onClick={() => { const t = newBadgeText.trim(); if (!t) return; setTrustBadges((p) => [...p, { icon: newBadgeIcon, text: t }]); setNewBadgeText(""); }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    Add Badge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-zinc-700">
          <Link href="/admin/products" className="px-6 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
            {isLoading ? "Updating..." : "Update Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
