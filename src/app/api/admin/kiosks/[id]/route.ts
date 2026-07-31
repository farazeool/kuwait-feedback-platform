import { isKioskStatus, kioskStatusList } from "@/lib/kiosk/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/admin/kiosks/[id]
 * Update a kiosk device configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id: deviceId } = await params;
    
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
      deviceName,
      surveyId,
      status,
      notes,
      changeReason,
    } = body;

    // Validate the status up front so an unknown value fails loudly instead of
    // reaching the database as an invalid enum literal.
    if (status !== undefined && !isKioskStatus(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Expected one of: ${kioskStatusList()}`,
        },
        { status: 400 }
      );
    }

    // Only forward fields the caller actually supplied. Sending null for an
    // absent field would erase the stored value on a partial update.
    const { data, error } = await supabase.rpc("update_kiosk_device", {
      p_device_id: deviceId,
      ...(deviceName !== undefined ? { p_device_name: deviceName } : {}),
      ...(surveyId !== undefined ? { p_survey_id: surveyId } : {}),
      ...(status !== undefined ? { p_status: status } : {}),
      ...(notes !== undefined ? { p_notes: notes } : {}),
      ...(changeReason !== undefined ? { p_change_reason: changeReason } : {}),
    });

    if (error) {
      console.error("Error updating kiosk device:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: data });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/admin/kiosks/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/kiosks/[id]
 * Archive a kiosk device (soft delete by setting status to archived)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id: deviceId } = await params;
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Archive by updating status only. Every other field is omitted rather than
    // passed as null so the RPC keeps the device's existing name/survey/notes
    // instead of blanking them out.
    const { data, error } = await supabase.rpc("update_kiosk_device", {
      p_device_id: deviceId,
      p_status: "archived",
      p_change_reason: "Device archived",
    });

    if (error) {
      console.error("Error archiving kiosk device:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: data });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/admin/kiosks/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
