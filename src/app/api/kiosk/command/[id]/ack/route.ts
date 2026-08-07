import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

const AckBodySchema = {
  parse(input: unknown): { success: boolean; failure_reason?: string } {
    if (typeof input !== "object" || input === null) {
      throw new Error("body must be an object");
    }
    const body = input as Record<string, unknown>;
    return {
      success: body.success === true,
      failure_reason:
        typeof body.failure_reason === "string"
          ? body.failure_reason
          : undefined,
    };
  },
};

/**
 * POST /api/kiosk/command/[id]/ack
 *
 * Device-facing acknowledgement endpoint. The kiosk calls this after
 * applying (or failing to apply) a command. The RPC verifies that
 * the credential matches the command's owning device so a kiosk
 * cannot acknowledge someone else's command.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: commandId } = await context.params;
  if (!commandId || typeof commandId !== "string") {
    return NextResponse.json({ error: "Missing command id" }, { status: 400 });
  }

  const cookieStore = await (async () => {
    const { cookies } = await import("next/headers");
    return cookies();
  })();
  const credential = cookieStore.get("kiosk_credential")?.value;
  if (!credential) {
    return NextResponse.json(
      { error: "Kiosk credential missing" },
      { status: 401 },
    );
  }

  let parsed;
  try {
    parsed = AckBodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid acknowledgement body",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("acknowledge_kiosk_command", {
    p_raw_credential: credential,
    p_command_id: commandId,
    p_success: parsed.success,
    p_failure_reason: parsed.failure_reason,
  });

  if (error) {
    const message = error.message ?? "Ack failed";
    const status = message.includes("does not belong")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: "Ack returned no row" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    commandId: row.command_id,
    status: row.status,
    acknowledgedAt: row.acknowledged_at,
  });
}
