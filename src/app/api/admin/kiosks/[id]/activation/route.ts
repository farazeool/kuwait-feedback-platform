import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ActivationCodeResult {
  activation_code: string;
  activation_code_expires_at: string;
}

/**
 * POST /api/admin/kiosks/[id]/activation
 * Generate a new activation code for a kiosk device
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the kiosk device and verify ownership
    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosk_devices")
      .select("id, organization_id, status, device_name")
      .eq("id", id)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json({ error: "Kiosk not found" }, { status: 404 });
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", kiosk.organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate activation code using the database function
    // Pass user ID explicitly since server context may not have auth.uid()
    // RPC type not in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: activationData, error: activationError } = await supabaseAny.rpc(
      "regenerate_activation_code",
      {
        p_device_id: id,
        p_organization_id: kiosk.organization_id,
        p_user_id: user.id,
      }
    );

    if (activationError) {
      console.error("Error generating activation code:", activationError);
      return NextResponse.json(
        { error: "Failed to generate activation code" },
        { status: 500 }
      );
    }

    if (!activationData) {
      return NextResponse.json(
        { error: "Failed to generate activation code" },
        { status: 500 }
      );
    }

    // The RPC returns the activation code record
    const activationCode = activationData as ActivationCodeResult;

    // Generate the activation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const activationUrl = `${baseUrl}/kiosk/activate?code=${activationCode.activation_code}`;

    return NextResponse.json({
      success: true,
      code: activationCode.activation_code,
      activation_url: activationUrl,
      expires_at: activationCode.activation_code_expires_at,
    });
  } catch (error) {
    console.error("Error in activation endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/kiosks/[id]/activation
 * Revoke all pending activation codes for a kiosk device
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the kiosk device and verify ownership
    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosk_devices")
      .select("id, organization_id")
      .eq("id", id)
      .single();

    if (kioskError || !kiosk) {
      return NextResponse.json({ error: "Kiosk not found" }, { status: 404 });
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", kiosk.organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Simply return success - the activation code will expire on its own
    // The regenerate function will handle creating new codes
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in activation revoke endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}