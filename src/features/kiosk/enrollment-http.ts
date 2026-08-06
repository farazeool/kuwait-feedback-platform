import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env/server";

export function buildSetupUrl(rawToken: string): string {
  const url = new URL(getServerEnv().NEXT_PUBLIC_APP_URL);
  url.pathname = "/kiosk/setup";
  url.searchParams.set("token", rawToken);
  return url.toString();
}

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

export const enrollmentJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: SECURITY_HEADERS });

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requestFingerprint(request: NextRequest, value: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const valueDigest = createHash("sha256").update(value).digest("hex");
  return createHash("sha256").update(`${forwarded}\u0000${valueDigest}`).digest("hex");
}

export async function consumeEnrollmentRateLimit(
  scope: string,
  keyHash: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const client = createSupabaseServiceRoleClient() as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await client.rpc("consume_kiosk_enrollment_rate_limit", {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    return !error && data === true;
  } catch {
    // Fail closed: weak rate limiting is less safe than a temporary retry.
    return false;
  }
}

export async function readSmallJson(request: NextRequest): Promise<unknown | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json")) return null;

  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 4096) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Resolves the HTTP-side kiosk device identity from the credential cookie.
 *
 * The credential cookie is HttpOnly and never reaches the browser, so reading
 * it here is the only place a request can be bound to a device. The credential
 * is validated through the committed RPC
 * `validate_kiosk_device_credential` and the resulting device row is then
 * fetched through the service-role client so the status check is read against
 * the live database, not against whatever the RPC cached.
 *
 * The function returns only the fields the API layer needs to make an
 * authorization decision. It never returns the raw credential, the credential
 * hash, the access token, or any other secret material.
 *
 * @returns `{ id, status, organization_id }` for a valid, non-revoked device,
 *          or `null` if no credential is present, the credential is invalid,
 *          or the device has been revoked or archived.
 */
export interface KioskCredentialAuth {
  id: string;
  status: string;
  organization_id: string;
}

export async function getKioskFromCredential(): Promise<KioskCredentialAuth | null> {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;
  if (!credential) return null;

  const client = createSupabaseServiceRoleClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };

  const { data, error } = await client.rpc("validate_kiosk_device_credential", {
    p_raw_credential: credential,
  });

  if (error || !data) {
    return null;
  }

  const row = Array.isArray(data)
    ? (data[0] as { kiosk_device_id?: string; organization_id?: string } | undefined)
    : (data as { kiosk_device_id?: string; organization_id?: string });
  const deviceId = row?.kiosk_device_id;
  const organizationId = row?.organization_id;
  if (!deviceId || !organizationId) {
    return null;
  }

  // The status check below uses the same validated device id. A revoked or
  // archived device is rejected so the API layer never enriches a request
  // from a credential that has been disabled.
  const { data: row2, error: rowError } = await client.rpc("get_kiosk_device_status", {
    p_kiosk_device_id: deviceId,
  });

  if (rowError || !row2) {
    return null;
  }

  const statusRow = Array.isArray(row2)
    ? (row2[0] as { status?: string } | undefined)
    : (row2 as { status?: string });
  const status = statusRow?.status;
  if (!status || status === "revoked" || status === "archived") {
    return null;
  }

  return { id: deviceId, status, organization_id: organizationId };
}
