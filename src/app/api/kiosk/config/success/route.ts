
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const successSchema = z.object({
  configVersion: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;

  if (!credential) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = successSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { configVersion } = parsed.data;

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("acknowledge_kiosk_configuration", {
    p_raw_credential: credential,
    p_config_version: configVersion,
  });

  if (error) {
    console.error("Error acknowledging kiosk configuration:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge configuration. " + error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data[0]);
}
