import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { NextRequest, NextResponse } from "next/server";

interface HeartbeatResponse {
  success: boolean;
  status?: string;
  survey_id?: string | null;
  location_id?: string | null;
  organization_id?: string;
  branding?: Record<string, unknown> | null;
  config_version?: number;
}

/**
 * POST /api/kiosk/heartbeat
 * Send device heartbeat to track online status
 * 
 * Supports two authentication methods:
 * 1. Cookie-based credential (from activation)
 * 2. Token in body (legacy support)
 * 
 * Body: { token?: string, deviceInfo?: { model, os, appVersion } }
 */
export async function POST(request: NextRequest) {
  try {
    // Try to get credential from cookie first
    const cookieStore = request.cookies;
    const credentialCookie = cookieStore.get("kiosk_credential")?.value;

    let body: { token?: string; deviceInfo?: { model?: string; os?: string; appVersion?: string } } = {};
    try {
      body = await request.json();
    } catch {
      // Body might be empty if using cookie auth
    }

    const { token, deviceInfo } = body;

    // Determine which authentication to use
    const accessToken = credentialCookie || token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAnonymousClient();

    // Call the RPC function to update heartbeat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data, error } = await supabaseAny.rpc("update_kiosk_heartbeat", {
      p_access_token: accessToken,
      p_device_model: deviceInfo?.model || null,
      p_device_os: deviceInfo?.os || null,
      p_app_version: deviceInfo?.appVersion || null,
    });

    if (error) {
      console.error("Error updating kiosk heartbeat:", error);
      return NextResponse.json(
        { error: "Invalid credential or device not found" },
        { status: 404 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Device not found or inactive" },
        { status: 404 }
      );
    }

    // The RPC returns device info on success
    const deviceData = data as {
      device_id: string;
      status: string;
      survey_id: string | null;
      location_id: string | null;
      organization_id: string;
      branding: Record<string, unknown> | null;
      config_version: number;
    };

    // Check if device is in a valid state
    if (deviceData.status === "revoked" || deviceData.status === "archived") {
      return NextResponse.json(
        { error: "Device is no longer active", status: deviceData.status },
        { status: 403 }
      );
    }

    const response: HeartbeatResponse = {
      success: true,
      status: deviceData.status,
      survey_id: deviceData.survey_id,
      location_id: deviceData.location_id,
      organization_id: deviceData.organization_id,
      branding: deviceData.branding,
      config_version: deviceData.config_version,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in POST /api/kiosk/heartbeat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}