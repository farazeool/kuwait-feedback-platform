import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import {
  CommandTypeSchema,
  IssueCommandBodySchema,
} from "@/features/kiosk/command-schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/kiosk/command
 *
 * Device-facing: returns the kiosk's next pending or delivered command
 * based on its credential cookie. The RPC enforces credential validity
 * and revocation internally, so a kiosk never sees commands addressed
 * to a different device.
 */
export async function GET() {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;

  if (!credential) {
    return NextResponse.json(
      { error: "Kiosk credential missing" },
      { status: 401 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("list_kiosk_pending_commands", {
    p_raw_credential: credential,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch pending command" },
      { status: error.message?.includes("Invalid") ? 401 : 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json({ command: null });
  }

  return NextResponse.json({
    command: {
      commandId: row.command_id,
      commandType: row.command_type,
      commandPayload: row.command_payload,
      desiredConfigVersion: row.desired_config_version,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
    },
  });
}

/**
 * POST /api/kiosk/command
 *
 * Admin issues a remote command against a single kiosk. The route is a
 * thin shim over the `issue_kiosk_command` RPC that:
 *
 *   - rejects unauthenticated callers;
 *   - looks up the caller's active organization membership and uses
 *     that to scope the request;
 *   - validates the JSON body against a strict zod schema (the
 *     database enforces the same shape with its own whitelist and
 *     idempotency, but catching it here gives a 400 with a clean
 *     message instead of an opaque RPC error);
 *   - calls the RPC which writes the command row, logs the activity,
 *     and returns the command id, status, and a `desired_config_version`
 *     so the UI can show the new desired version.
 */
export async function POST(request: Request) {
  let context;
  try {
    context = await requireOrganizationManagementContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = context.membership?.organizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization membership" },
      { status: 403 },
    );
  }

  let payload;
  try {
    payload = IssueCommandBodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid command payload",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("issue_kiosk_command", {
    p_kiosk_device_id: payload.kiosk_device_id,
    p_command_type: CommandTypeSchema.parse(payload.command_type),
    p_command_payload: payload.command_payload ?? null,
    p_idempotency_key: payload.idempotency_key,
  });

  if (error) {
    const message = error.message ?? "Command failed";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("Cannot issue") ||
          message.includes("Kiosk is already revoked") ||
          message.includes("Re-enroll requires")
        ? 409
        : message.includes("not found")
          ? 404
          : 400;

    return NextResponse.json(
      { error: message, code: error.code ?? null },
      { status },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: "Command issuance returned no row" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    commandId: row.command_id,
    status: row.status,
    desiredConfigVersion: row.desired_config_version,
    alreadyExisted: row.already_existed,
  });
}
