import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
  errorResponse,
  HTTP_STATUS,
  requireAdmin,
  successResponse,
  validateRequest,
} from "@/lib/api-utils";

const updateGASettingsSchema = z.object({
  measurement_id: z.string().regex(/^G-[A-Z0-9]+$|^$/, "Invalid GA4 Measurement ID format (must be G-XXXXXXXXXX)").optional(),
  enabled: z.boolean().optional(),
  enabled_events: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return authResult.error;
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("google_analytics_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Failed to fetch GA settings:", error);
      return errorResponse(
        "FETCH_FAILED",
        "Failed to fetch Google Analytics settings",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return successResponse(data);
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return authResult.error;
    }

    const validation = await validateRequest(request, updateGASettingsSchema);

    if (validation.error) {
      return validation.error;
    }

    const { measurement_id, enabled, enabled_events } = validation.data;
    const supabase = await createAdminClient();

    // Get existing row
    const { data: existing, error: fetchError } = await supabase
      .from("google_analytics_settings")
      .select("id")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return errorResponse(
        "FETCH_FAILED",
        "Failed to fetch existing settings",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (measurement_id !== undefined) updatePayload.measurement_id = measurement_id;
    if (enabled !== undefined) updatePayload.enabled = enabled;
    if (enabled_events !== undefined) updatePayload.enabled_events = enabled_events;

    if (existing?.id) {
      // Update
      const { data: updated, error: updateError } = await supabase
        .from("google_analytics_settings")
        .update(updatePayload)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        return errorResponse(
          "UPDATE_FAILED",
          "Failed to update Google Analytics settings",
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return successResponse(updated);
    } else {
      // Insert
      const { data: inserted, error: insertError } = await supabase
        .from("google_analytics_settings")
        .insert({
          measurement_id: measurement_id || "",
          enabled: enabled ?? false,
          enabled_events: enabled_events || ["page_view"],
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(
          "INSERT_FAILED",
          "Failed to create Google Analytics settings",
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return successResponse(inserted);
    }
  } catch {
    return errorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
