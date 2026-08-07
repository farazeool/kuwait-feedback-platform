import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  activationFailureMessage,
  canAdministerKioskActivation,
  parseActivationRpcResult,
} from "@/features/kiosk/activation-result";

/**
 * Kiosk activation endpoints.
 *
 * POST  - issue a fresh activation code for a device awaiting activation.
 * GET   - report activation status (never returns a recoverable code: only the
 *         hash is persisted, so the code cannot be shown again after issuing).
 * DELETE- reserved for real setup-link revocation (not yet implemented).
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * The kiosk activation RPCs were added by migrations that post-date the
 * checked-in generated types in `src/types/database.ts`, so they are absent
 * from the `rpc()` function-name union. Regenerating those types requires a
 * database round-trip and is out of scope for this change, so we call through
 * a narrow structural shim instead of widening the whole Supabase client.
 */
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>;

function looseRpc(client: { rpc: unknown }): LooseRpc {
  return client.rpc as unknown as LooseRpc;
}

/** Shape returned by `get_kiosk_activation_details` (a RETURNS TABLE fn). */
interface ActivationDetailsRow {
  id?: unknown;
  device_name?: unknown;
  status?: unknown;
  is_activated?: unknown;
  activated_at?: unknown;
  activation_code_expires_at?: unknown;
  activation_code_consumed_at?: unknown;
}

/** Resolves the caller, the target kiosk and the caller's privilege in one pass. */
async function authorizeKioskAdmin(deviceId: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const { data: kiosk, error: kioskError } = await supabase
    .from("kiosk_devices")
    .select("id, organization_id, status, device_name")
    .eq("id", deviceId)
    .single();

  if (kioskError || !kiosk) {
    return {
      supabase,
      error: NextResponse.json({ error: "Kiosk not found" }, { status: 404 }),
    } as const;
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("organization_id", kiosk.organization_id)
    .single();

  // Membership alone is NOT sufficient: only an active owner/admin may mint or
  // manage activation credentials. A viewer or suspended member is rejected
  // here rather than being allowed through to raise a SQL exception.
  if (!canAdministerKioskActivation(membership)) {
    return {
      supabase,
      error: NextResponse.json(
        { error: "You do not have permission to manage this device." },
        { status: 403 }
      ),
    } as const;
  }

  return { supabase, user, kiosk, error: null } as const;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await authorizeKioskAdmin(id);
    if (auth.error) return auth.error;

    const { supabase, user, kiosk } = auth;

    const { data, error } = await looseRpc(supabase)(
      "regenerate_activation_code",
      {
        p_device_id: kiosk.id,
        p_organization_id: kiosk.organization_id,
        p_user_id: user.id,
      }
    );

    // `regenerate_activation_code` is declared RETURNS TABLE, so PostgREST
    // sends an ARRAY of rows. Casting it straight to an object yielded
    // `undefined` for every field, which produced the blank Activation Code
    // and the "N/A" expiry. Unwrap and validate instead of casting.
    const result = parseActivationRpcResult(data, error);

    if (!result.ok) {
      // Log internals server-side only; never leak them to the operator.
      console.error("Activation generation failed", {
        deviceId: kiosk.id,
        reason: result.reason,
      });

      const status = result.reason === "no_rows" ? 409 : 502;
      return NextResponse.json(
        { error: activationFailureMessage(result.reason) },
        { status }
      );
    }

    const activationUrl = new URL("/kiosk/activate", request.nextUrl.origin);
    activationUrl.searchParams.set("code", result.code);

    // Only reached when a single well-formed row carried BOTH a non-empty code
    // and a valid expiry, so the client can safely render a ready state.
    return NextResponse.json({
      code: result.code,
      activation_url: activationUrl.toString(),
      expires_at: result.expiresAt,
    });
  } catch (err) {
    console.error("Unexpected error generating activation code", err);
    return NextResponse.json(
      { error: "Could not generate an activation code. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await authorizeKioskAdmin(id);
    if (auth.error) return auth.error;

    const { supabase, kiosk } = auth;

    const { data, error } = await looseRpc(supabase)(
      "get_kiosk_activation_details",
      {
        p_device_id: kiosk.id,
        p_organization_id: kiosk.organization_id,
      }
    );

    if (error) {
      console.error("Activation details lookup failed", {
        deviceId: kiosk.id,
      });
      return NextResponse.json(
        { error: "Could not load activation status. Please try again." },
        { status: 502 }
      );
    }

    // Also a RETURNS TABLE function: unwrap the array rather than casting.
    const row = (Array.isArray(data) ? data[0] : data) as
      | ActivationDetailsRow
      | null
      | undefined;

    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Kiosk not found" }, { status: 404 });
    }

    // NOTE: the RPC deliberately returns NULL for activation_code because only
    // the hash is stored. We therefore never advertise a recoverable code.
    return NextResponse.json({
      id: row.id,
      device_name: row.device_name,
      status: row.status,
      is_activated: row.is_activated,
      activated_at: row.activated_at,
      expires_at: row.activation_code_expires_at ?? null,
      consumed_at: row.activation_code_consumed_at ?? null,
      code_recoverable: false,
    });
  } catch (err) {
    console.error("Unexpected error loading activation details", err);
    return NextResponse.json(
      { error: "Could not load activation status. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await authorizeKioskAdmin(id);
  if (auth.error) return auth.error;

  // Previously this returned `{ success: true }` without revoking anything,
  // which told operators a setup link had been invalidated when it had not.
  // Truthful revocation requires the enrollment-session model (next phase), so
  // report honestly instead of reporting a revocation that never happened.
  return NextResponse.json(
    {
      revoked: false,
      error:
        "Revoking a setup link is not available yet. Generate a new activation code to supersede the previous one.",
    },
    { status: 501 }
  );
}
