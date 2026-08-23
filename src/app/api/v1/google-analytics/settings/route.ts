import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { successResponse } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("google_analytics_settings")
      .select("measurement_id, enabled, enabled_events")
      .maybeSingle();

    if (error || !data) {
      return successResponse({
        enabled: false,
        measurementId: "",
        enabledEvents: [],
      });
    }

    return successResponse({
      enabled: data.enabled ?? false,
      measurementId: data.measurement_id ?? "",
      enabledEvents: data.enabled_events ?? [],
    });
  } catch {
    return successResponse({
      enabled: false,
      measurementId: "",
      enabledEvents: [],
    });
  }
}
