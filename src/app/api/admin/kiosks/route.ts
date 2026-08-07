import { isKioskStatus, kioskStatusList } from "@/lib/kiosk/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/kiosks
 * List all kiosk devices for an organization
 * Query params:
 *   - organizationId: required
 *   - locationId: optional filter
 *   - status: optional filter
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get("organizationId");
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Reject an unknown status rather than silently returning unfiltered rows.
    if (status !== null && !isKioskStatus(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Expected one of: ${kioskStatusList()}`,
        },
        { status: 400 }
      );
    }
    const statusFilter = status ?? undefined;

    // Omitted filters must be `undefined` so the RPC applies its own defaults;
    // passing null would be sent as an explicit SQL NULL argument.
    const { data, error } = await supabase.rpc("list_kiosk_devices", {
      p_organization_id: organizationId,
      p_location_id: locationId ?? undefined,
      p_status: statusFilter,
    });

    if (error) {
      console.error("Error listing kiosk devices:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ devices: data });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/kiosks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/kiosks
 * Create a new kiosk device
 * Body:
 *   - organizationId: required
 *   - locationId: required
 *   - deviceName: required
 *   - deviceIdentifier: optional
 *   - surveyId: optional
 *   - notes: optional
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      organizationId,
      locationId,
      deviceName,
      deviceIdentifier,
      surveyId,
      notes,
    } = body;

    // Validate required fields
    if (!organizationId || !locationId || !deviceName) {
      return NextResponse.json(
        { error: "organizationId, locationId, and deviceName are required" },
        { status: 400 }
      );
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc("create_kiosk_device", {
      p_organization_id: organizationId,
      p_location_id: locationId,
      p_device_name: deviceName,
      p_device_identifier: deviceIdentifier || null,
      p_survey_id: surveyId || null,
      p_notes: notes || null,
    });

    if (error) {
      console.error("Error creating kiosk device:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ deviceId: data }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/admin/kiosks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
