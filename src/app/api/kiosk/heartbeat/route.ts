import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/kiosk/heartbeat
 * Send device heartbeat to track online status
 * Body: { token: string, deviceInfo?: { model, os, appVersion } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, deviceInfo } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAnonymousClient();

    // Call the RPC function to update heartbeat
    const { data, error } = await supabase.rpc("update_kiosk_heartbeat", {
      p_access_token: token,
      p_device_model: deviceInfo?.model || null,
      p_device_os: deviceInfo?.os || null,
      p_app_version: deviceInfo?.appVersion || null,
    });

    if (error) {
      console.error("Error updating kiosk heartbeat:", error);
      return NextResponse.json(
        { error: "Invalid access token or device not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: data });
  } catch (error) {
    console.error("Unexpected error in POST /api/kiosk/heartbeat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
