import "server-only";

import { createHash } from "node:crypto";
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
