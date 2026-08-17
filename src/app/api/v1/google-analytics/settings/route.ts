import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { successResponse } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("google_analytics_settings")
      .select("measurement_id, enabled, enabled_events")
      .single();

    if (error) {
      console.error("Failed to fetch GA settings:", error);
      return successResponse({
        enabled: false,
        measurementId: "",
        enabledEvents: [],
      });
    }

    return successResponse({
      enabled: data?.enabled ?? false,
      measurementId: data?.measurement_id ?? "",
      enabledEvents: data?.enabled_events ?? [],
    });
  } catch (err) {
    console.error("GA settings fetch error:", err);
    return successResponse({
      enabled: false,
      measurementId: "",
      enabledEvents: [],
    });
  }
}
