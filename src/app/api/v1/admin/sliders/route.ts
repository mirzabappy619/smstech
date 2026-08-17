import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";

export const defaultSliders = [
  {
    id: "slide-1",
    title: "Next-Gen Laptops & Workstations",
    subtitle: "Experience unmatched speed with Apple M3, Intel 14th Gen & RTX Graphics laptops.",
    badge: "⚡ NEW ARRIVALS 2026",
    image_url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=600&fit=crop&auto=format",
    link_url: "/laptops",
    button_text: "Explore Laptops",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "slide-2",
    title: "Certified Pre-Owned Laptops",
    subtitle: "Premium business laptops from HP, Dell & Microsoft at unbeatable prices with 6 months warranty.",
    badge: "🔥 PRE-OWNED DEALS",
    image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1200&h=600&fit=crop&auto=format",
    link_url: "/laptops?cat=pre-owned",
    button_text: "Shop Pre-Owned",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "slide-3",
    title: "Flagship Smartphones & Accessories",
    subtitle: "Upgrade to iPhone 17 Pro & Galaxy S26 Ultra with official brand warranty & EMI option.",
    badge: "📱 OFFICIAL WARRANTY",
    image_url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1200&h=600&fit=crop&auto=format",
    link_url: "/smartphones",
    button_text: "Browse Smartphones",
    sort_order: 3,
    is_active: true,
  },
];

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: sliders, error } = await supabase
      .from("hero_sliders")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && sliders && sliders.length > 0) {
      return jsonResponse(sliders);
    }
  } catch {
    // Fallback to default sliders
  }
  return jsonResponse(defaultSliders);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();

    const { data: slide, error } = await supabase
      .from("hero_sliders")
      .insert({
        title: body.title,
        subtitle: body.subtitle,
        badge: body.badge || "FEATURED",
        image_url: body.image_url,
        link_url: body.link_url || "/laptops",
        button_text: body.button_text || "Shop Now",
        sort_order: body.sort_order || 1,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return errorResponse("SLIDE_CREATE_FAILED", error.message, 500);
    }

    return jsonResponse(slide);
  } catch (error: any) {
    return errorResponse("INTERNAL_ERROR", error.message || "Failed to create slide", 500);
  }
}
