
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const failureSchema = z.object({
  configVersion: z.number().int().positive(),
  errorCode: z.string().max(50),
  errorMessage: z.string().max(255),
});

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;

  if (!credential) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = failureSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { configVersion, errorCode, errorMessage } = parsed.data;

  const supabase = createSupabaseServiceRoleClient() as any;
  const { data, error } = await supabase.rpc("report_kiosk_configuration_failure", {
    p_raw_credential: credential,
    p_config_version: configVersion,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });

  if (error) {
    console.error("Error reporting kiosk configuration failure:", error);
    return NextResponse.json(
      { error: "Failed to report failure. " + error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data[0]);
}
