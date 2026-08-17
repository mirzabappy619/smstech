import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createServerClient();

    const { data: slide, error } = await supabase
      .from("hero_sliders")
      .update({
        title: body.title,
        subtitle: body.subtitle,
        badge: body.badge,
        image_url: body.image_url,
        link_url: body.link_url,
        button_text: body.button_text,
        sort_order: body.sort_order,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return errorResponse("SLIDE_UPDATE_FAILED", error.message, 500);
    }

    return jsonResponse(slide);
  } catch (error: any) {
    return errorResponse("INTERNAL_ERROR", error.message || "Failed to update slide", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("hero_sliders")
      .delete()
      .eq("id", id);

    if (error) {
      return errorResponse("SLIDE_DELETE_FAILED", error.message, 500);
    }

    return jsonResponse({ success: true, message: "Slide deleted successfully" });
  } catch (error: any) {
    return errorResponse("INTERNAL_ERROR", error.message || "Failed to delete slide", 500);
  }
}
