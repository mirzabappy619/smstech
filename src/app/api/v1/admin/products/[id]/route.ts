import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
  errorResponse,
  HTTP_STATUS,
  jsonResponse,
  notFoundResponse,
  requireAdmin,
  validateRequest,
} from "@/lib/api-utils";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateVariationSchema = z.object({
  id: z.string().optional(), // present for existing, absent for new
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(100),
  price: z.number().nonnegative(), // allow $0 variations
  attributes: z.record(z.string()).default({}),
  is_active: z.boolean().default(true),
  is_auto_generated: z.boolean().default(false),
  images: z.array(z.string().url()).default([]),
  // Optional per-warehouse stock (used by the new inventory UI)
  warehouse_stocks: z
    .array(
      z.object({
        warehouse_id: z.string().uuid(),
        quantity_in_packages: z.number().int().nonnegative(),
      })
    )
    .optional()
    .default([]),
});

const unitSystemSchema = z.object({
  baseUnit: z.enum(["piece", "pair", "dozen", "pack"]),
  unitsPerPackage: z.number().int().positive(),
  packageName: z.string().min(1).max(100),
}).default({ baseUnit: "piece", unitsPerPackage: 1, packageName: "Individual" });

const attributeDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  values: z.array(z.string().min(1).max(100)).min(1),
  displayOrder: z.number().int().nonnegative(),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
    .optional(),
  description: z.string().trim().nullable().optional(),
  short_description: z.string().trim().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  brand: z.string().trim().optional(),
  base_price: z.number().nonnegative().optional(),
  compare_at_price: z.number().nonnegative().nullable().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  is_digital: z.boolean().optional(),
  track_inventory: z.boolean().optional(),
  seo_title: z.string().trim().max(70).nullable().optional(),
  seo_description: z.string().trim().max(160).nullable().optional(),
  seo_keywords: z.string().trim().optional(),
  images: z.array(z.string()).optional(),
  variations: z.array(updateVariationSchema).optional(),
  trust_badges: z
    .array(z.object({ icon: z.string(), text: z.string() }))
    .optional(),
  // Variation system
  unit_system: unitSystemSchema.optional(),
  attribute_definitions: z.array(attributeDefinitionSchema).optional(),
});

// ─── GET /api/v1/admin/products/[id] ─────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createAdminClient();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `*,
        category:categories(id, name, slug),
        variations:product_variations(
          *,
          inventory(quantity, reserved_quantity, available_quantity, location_id)
        )`,
      )
      .eq("id", id)
      .single();

    if (error || !product) {
      return notFoundResponse("Product");
    }

    // Aggregate per-variation stock totals from inventory rows
    const enriched = {
      ...product,
      variations: (product.variations ?? []).map(
        (v: {
          inventory?: { quantity: number; reserved_quantity: number; available_quantity: number }[];
          [key: string]: unknown;
        }) => {
          const inv = v.inventory ?? [];
          const total_quantity = inv.reduce((s: number, r: { quantity: number }) => s + (r.quantity ?? 0), 0);
          const total_reserved = inv.reduce((s: number, r: { reserved_quantity: number }) => s + (r.reserved_quantity ?? 0), 0);
          const total_available = inv.reduce((s: number, r: { available_quantity: number }) => s + (r.available_quantity ?? 0), 0);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { inventory: _inv, ...rest } = v;
          return { ...rest, total_quantity, total_reserved, total_available };
        },
      ),
    };

    return jsonResponse(enriched);
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

// ─── PUT /api/v1/admin/products/[id] ─────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { id } = await params;

    const validation = await validateRequest(request, updateProductSchema);
    if (validation.error) return validation.error;

    const supabase = await createAdminClient();

    // Confirm product exists
    const { data: existing, error: existingError } = await supabase
      .from("products")
      .select("id, metadata")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return notFoundResponse("Product");
    }

    const {
      brand,
      seo_keywords,
      variations,
      images,
      trust_badges,
      unit_system,
      attribute_definitions,
      track_inventory,
      ...rest
    } = validation.data;

    // Build update payload (only include provided fields)
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (rest.name !== undefined) updatePayload.name = rest.name;
    if (rest.slug !== undefined) updatePayload.slug = rest.slug;
    if (Object.prototype.hasOwnProperty.call(rest, "description"))
      updatePayload.description = rest.description ?? null;
    if (Object.prototype.hasOwnProperty.call(rest, "short_description"))
      updatePayload.short_description = rest.short_description ?? null;
    if (Object.prototype.hasOwnProperty.call(rest, "category_id"))
      updatePayload.category_id = rest.category_id ?? null;
    if (rest.base_price !== undefined) updatePayload.base_price = rest.base_price;
    if (Object.prototype.hasOwnProperty.call(rest, "compare_at_price"))
      updatePayload.compare_at_price = rest.compare_at_price ?? null;
    if (Object.prototype.hasOwnProperty.call(rest, "cost_price"))
      updatePayload.cost_price = rest.cost_price ?? null;
    if (rest.sku !== undefined) updatePayload.sku = rest.sku;
    if (Object.prototype.hasOwnProperty.call(rest, "barcode"))
      updatePayload.barcode = rest.barcode ?? null;
    if (Object.prototype.hasOwnProperty.call(rest, "weight"))
      updatePayload.weight = rest.weight ?? null;
    if (rest.is_active !== undefined) updatePayload.is_active = rest.is_active;
    if (rest.is_featured !== undefined) updatePayload.is_featured = rest.is_featured;
    if (rest.is_digital !== undefined) {
      updatePayload.is_digital = rest.is_digital;
      updatePayload.requires_shipping = !rest.is_digital;
    }
    if (track_inventory !== undefined) updatePayload.track_inventory = track_inventory;
    if (Object.prototype.hasOwnProperty.call(rest, "seo_title"))
      updatePayload.seo_title = rest.seo_title ?? null;
    if (Object.prototype.hasOwnProperty.call(rest, "seo_description"))
      updatePayload.seo_description = rest.seo_description ?? null;
    if (seo_keywords !== undefined) {
      updatePayload.seo_keywords = seo_keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    if (images !== undefined) updatePayload.images = images;

    // Variation system columns (added by migration 009/010)
    if (unit_system !== undefined) updatePayload.unit_system = unit_system;
    if (attribute_definitions !== undefined) updatePayload.attribute_definitions = attribute_definitions;

    // Merge brand and trust_badges into metadata
    if (brand !== undefined || trust_badges !== undefined) {
      const existingMeta =
        typeof existing.metadata === "object" && existing.metadata !== null
          ? (existing.metadata as Record<string, unknown>)
          : {};
      const newMeta = { ...existingMeta };
      if (brand !== undefined) newMeta.brand = brand || null;
      if (trust_badges !== undefined) newMeta.trust_badges = trust_badges;
      updatePayload.metadata = newMeta;
    }

    const { data: product, error: updateError } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      if (updateError.code === "23505") {
        const conflictField = updateError.message.includes("sku") ? "sku" : "slug";
        return errorResponse(
          "PRODUCT_EXISTS",
          `A product with this ${conflictField} already exists`,
          HTTP_STATUS.CONFLICT,
        );
      }
      return errorResponse(
        "PRODUCT_UPDATE_FAILED",
        updateError.message || "Failed to update product",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    // Handle variations if provided
    if (variations !== undefined) {
      const incomingIds = variations.filter((v) => v.id).map((v) => v.id as string);

      // Delete variations no longer in the list
      const { error: deleteError } = await supabase
        .from("product_variations")
        .delete()
        .eq("product_id", id)
        .not(
          "id",
          "in",
          incomingIds.length > 0 ? `(${incomingIds.join(",")})` : "(null)",
        );

      if (deleteError) {
        console.error("Failed to delete removed variations:", deleteError);
      }

      for (const variation of variations) {
        if (variation.id) {
          // Update existing variation
          await supabase
            .from("product_variations")
            .update({
              name: variation.name,
              sku: variation.sku,
              price: variation.price,
              attributes: variation.attributes,
              is_active: variation.is_active,
              is_auto_generated: variation.is_auto_generated ?? false,
              images: variation.images ?? [],
              updated_at: new Date().toISOString(),
            })
            .eq("id", variation.id)
            .eq("product_id", id);
        } else {
          // Insert new variation
          const { data: newVar } = await supabase
            .from("product_variations")
            .insert({
              product_id: id,
              name: variation.name,
              sku: variation.sku,
              price: variation.price,
              attributes: variation.attributes,
              is_active: variation.is_active,
              is_auto_generated: variation.is_auto_generated ?? false,
              images: variation.images ?? [],
            })
            .select("id")
            .single();

          // Seed inventory records
          if (newVar?.id) {
            const warehouseStocks = variation.warehouse_stocks ?? [];

            if (warehouseStocks.length > 0) {
              // Use the explicit per-warehouse quantities from the UI
              await supabase.from("inventory").upsert(
                warehouseStocks.map((ws) => ({
                  product_id: id,
                  variation_id: newVar.id,
                  location_id: ws.warehouse_id,
                  quantity: ws.quantity_in_packages,
                  reserved_quantity: 0,
                })),
                { onConflict: "product_id,variation_id,location_id" },
              );
            } else {
              // Fall back to default warehouse with 0 stock
              const { data: defaultLoc } = await supabase
                .from("locations")
                .select("id")
                .eq("is_default", true)
                .single();

              if (defaultLoc) {
                await supabase.from("inventory").upsert(
                  {
                    product_id: id,
                    variation_id: newVar.id,
                    location_id: defaultLoc.id,
                    quantity: 0,
                    reserved_quantity: 0,
                  },
                  { onConflict: "product_id,variation_id,location_id" },
                );
              }
            }
          }
        }
      }
    }

    // Return product with fresh variations (using variation_stock_summary if available)
    const { data: finalProduct } = await supabase
      .from("products")
      .select("*, variations:product_variations(*)")
      .eq("id", id)
      .single();

    return jsonResponse(finalProduct || product);
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

// ─── DELETE /api/v1/admin/products/[id] ──────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createAdminClient();

    const { data: deleted, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return errorResponse(
        "PRODUCT_DELETE_FAILED",
        "Failed to delete product",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    if (!deleted) {
      return notFoundResponse("Product");
    }

    return jsonResponse({ id, deleted: true });
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
