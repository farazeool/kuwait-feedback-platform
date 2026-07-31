import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { NextRequest, NextResponse } from "next/server";

/**
 * This endpoint must never be cached or statically rendered: a kiosk polls it
 * to discover remote configuration changes, and a cached response would let a
 * paused or revoked device keep serving the old survey indefinitely.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

/**
 * GET /api/kiosk/config?token=<access_token>
 * Get kiosk configuration for polling
 * Used by kiosk devices to check for remote configuration updates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accessToken = searchParams.get("token");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createSupabaseAnonymousClient();

    // Call the RPC function to get config and update last_seen
    const { data, error } = await supabase.rpc("get_kiosk_config", {
      p_access_token: accessToken,
    });

    if (error) {
      // Do not leak the token or the underlying database message to the device.
      console.error("Error getting kiosk config:", error.message);
      return NextResponse.json(
        { error: "Invalid access token or device not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Device configuration not found" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const config = data[0];

    return NextResponse.json(
      {
        deviceId: config.device_id,
        deviceName: config.device_name,
        // Null unless the device is active. The kiosk must treat a null slug as
        // "do not render a survey" rather than falling back to a previous one.
        surveyPublicSlug: config.survey_public_slug,
        status: config.status,
        defaultLanguage: config.default_language,
        branding: config.branding ?? {},
        idleTimeoutSeconds: config.idle_timeout_seconds,
        lastConfigChange: config.last_config_change,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("Unexpected error in GET /api/kiosk/config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
