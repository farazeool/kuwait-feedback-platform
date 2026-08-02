import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ActivateResult {
  device_id: string;
  public_id: string;
  credential: string;
}

/**
 * POST /api/kiosk/activate
 * Activate a kiosk device using an activation code
 * This is a public endpoint that consumes a one-time activation code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Activation code is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Use the database function to activate the device
    // This function:
    // 1. Validates the activation code
    // 2. Checks if it's expired or already used
    // 3. Generates a new device credential
    // 4. Stores the credential hash
    // 5. Returns the device info and raw credential
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: result, error: activateError } = await supabaseAny.rpc(
      "activate_kiosk_device",
      {
        p_activation_code: code.toUpperCase().trim(),
      }
    );

    if (activateError) {
      console.error("Activation error:", activateError);
      // Return a generic error to avoid revealing whether the code exists
      return NextResponse.json(
        { error: "Invalid or expired activation code" },
        { status: 400 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired activation code" },
        { status: 400 }
      );
    }

    const activationResult = result as ActivateResult;

    // Set the credential as an HttpOnly secure cookie
    const response = NextResponse.json({
      success: true,
      device_id: activationResult.device_id,
      public_id: activationResult.public_id,
    });

    // Set the credential cookie - HttpOnly, Secure, SameSite Strict
    response.cookies.set("kiosk_credential", activationResult.credential, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/kiosk",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return response;
  } catch (error) {
    console.error("Error in activation endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}