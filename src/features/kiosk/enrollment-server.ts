import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENROLLMENT_TTL_DEFAULT_MINUTES,
  type EnrollmentResult,
  type EnrollmentSessionDetails,
  type ExchangedEnrollment,
  type IssuedEnrollmentSession,
  type RevokeEnrollmentSessionResult,
  type ValidatedDeviceCredential,
  isValidEnrollmentTtl,
  mapDatabaseError,
  parseEnrollmentSessionDetails,
  parseExchangedEnrollment,
  parseIssuedEnrollmentSession,
  parseMarkOpenedResult,
  parseRevokeEnrollmentSessionResult,
  parseValidatedDeviceCredential,
} from "@/features/kiosk/enrollment-contracts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

/**
 * Server-only bindings for the committed kiosk enrollment RPCs.
 *
 * Two client kinds are used deliberately, because the committed grants split
 * the surface in two:
 *
 *   authenticated  issue_kiosk_enrollment_session
 *                  get_kiosk_enrollment_session_details
 *                  revoke_kiosk_enrollment_session
 *
 *   service_role   exchange_kiosk_enrollment_token
 *                  mark_kiosk_enrollment_session_opened
 *                  validate_kiosk_device_credential
 *
 * The three administrator RPCs are SECURITY DEFINER but authorize internally
 * through `kiosk_admin_can_manage_org()`, which reads `auth.uid()`. They must
 * therefore be invoked with the caller's own authenticated client — running
 * them as service_role would produce a NULL `auth.uid()` and be refused. That
 * also means organization isolation stays enforced in the database, not merely
 * in the route.
 *
 * Only the device-facing exchange path uses the service_role client, because
 * the enrollment token arrives from an unauthenticated iPad and the exchange
 * RPC is granted to service_role alone.
 *
 * Every function returns a discriminated `EnrollmentResult`. Nothing throws on
 * a database error and no raw PostgREST payload is ever returned to a caller,
 * so route handlers cannot accidentally forward driver internals to a browser.
 */

/** The authenticated, cookie-bound client used for administrator RPCs. */
type AuthedClient = SupabaseClient<Database>;

/* ===========================================================================
 * Administrator surface — authenticated client, org isolation in the database
 * ======================================================================== */

/**
 * Issues a fresh enrollment session for a kiosk.
 *
 * This same RPC also performs regeneration: it supersedes any active session
 * for the kiosk and reports that through `supersededPrevious`, so there is no
 * separate regenerate function to call.
 *
 * The raw token exists in the response and nowhere else afterwards — only its
 * hash is persisted — so the caller is responsible for handing it to the
 * administrator once and never logging it.
 */
export async function issueEnrollmentSession(
  supabase: AuthedClient,
  kioskDeviceId: string,
  ttlMinutes: number = ENROLLMENT_TTL_DEFAULT_MINUTES,
): Promise<EnrollmentResult<IssuedEnrollmentSession>> {
  if (!isValidEnrollmentTtl(ttlMinutes)) {
    return { ok: false, reason: "invalid_ttl" };
  }

  const { data, error } = await supabase.rpc("issue_kiosk_enrollment_session", {
    p_kiosk_device_id: kioskDeviceId,
    p_ttl_minutes: ttlMinutes,
  });

  return parseIssuedEnrollmentSession(data, error);
}

/**
 * Reads non-secret metadata for a kiosk's current enrollment session.
 *
 * This path can never reveal the raw token — the RPC does not return it and the
 * hash is not selected — so reopening the administrator panel is always safe.
 * A `null` value means the kiosk has no session yet (Draft), which is a normal
 * state rather than a failure.
 */
export async function getEnrollmentSessionDetails(
  supabase: AuthedClient,
  kioskDeviceId: string,
): Promise<EnrollmentResult<EnrollmentSessionDetails | null>> {
  const { data, error } = await supabase.rpc(
    "get_kiosk_enrollment_session_details",
    { p_kiosk_device_id: kioskDeviceId },
  );

  return parseEnrollmentSessionDetails(data, error);
}

/**
 * Revokes the active enrollment session for a kiosk.
 *
 * The RPC's outcome is surfaced verbatim rather than collapsed into a boolean,
 * so the interface can tell the truth: a link that was already consumed is
 * reported as `already_used`, not as a successful revocation.
 */
export async function revokeEnrollmentSession(
  supabase: AuthedClient,
  kioskDeviceId: string,
): Promise<EnrollmentResult<RevokeEnrollmentSessionResult>> {
  const { data, error } = await supabase.rpc(
    "revoke_kiosk_enrollment_session",
    { p_kiosk_device_id: kioskDeviceId },
  );

  return parseRevokeEnrollmentSessionResult(data, error);
}

/* ===========================================================================
 * Device surface — service_role client, never reachable from the browser
 * ======================================================================== */

/**
 * Atomically exchanges a raw setup token for a device credential.
 *
 * This consumes the session, so it runs only after an explicit user action on
 * the iPad — never during a GET, prefetch, link preview or crawl. A replayed
 * token resolves to `already_used` inside the RPC and surfaces here as a
 * failure reason, not as a second credential.
 *
 * The returned `rawDeviceCredential` is the only copy in existence; the
 * database keeps a hash. It must go straight into an HttpOnly cookie and must
 * never be logged, echoed in a URL, or returned in a response body.
 */
export async function exchangeEnrollmentToken(
  rawToken: string,
): Promise<EnrollmentResult<ExchangedEnrollment>> {
  if (typeof rawToken !== "string" || rawToken.length < 20) {
    return { ok: false, reason: "invalid_link" };
  }

  let data: unknown;
  let error: unknown;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const response = await supabase.rpc("exchange_kiosk_enrollment_token", {
      p_raw_token: rawToken,
    });
    data = response.data;
    error = response.error;
  } catch {
    // A misconfigured service_role key must not surface as a stack trace, and
    // its message must never reach the device.
    return { ok: false, reason: "database_error" };
  }

  return parseExchangedEnrollment(data, error);
}

/**
 * Records that a setup link was opened on a device.
 *
 * This is intentionally non-consuming: it lets the administrator panel show a
 * "Link opened" state without spending the token. Failure is never propagated
 * to the enrollment page, because telemetry must not block a real enrollment.
 */
export async function markEnrollmentSessionOpened(
  rawToken: string,
): Promise<EnrollmentResult<boolean>> {
  if (typeof rawToken !== "string" || rawToken.length < 20) {
    return { ok: false, reason: "invalid_link" };
  }

  let data: unknown;
  let error: unknown;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const response = await supabase.rpc(
      "mark_kiosk_enrollment_session_opened",
      { p_raw_token: rawToken },
    );
    data = response.data;
    error = response.error;
  } catch {
    return { ok: false, reason: "database_error" };
  }

  return parseMarkOpenedResult(data, error);
}

/**
 * Validates a device credential presented by an enrolled kiosk.
 *
 * Used by the kiosk runtime to resolve a credential into its device and
 * organization. Resolves to a failure reason rather than throwing, so a bad or
 * revoked credential produces a clean "re-enroll" state instead of a crash.
 */
export async function validateDeviceCredential(
  rawCredential: string,
): Promise<EnrollmentResult<ValidatedDeviceCredential | null>> {
  if (typeof rawCredential !== "string" || rawCredential.length < 8) {
    // Zero rows is how the SQL signals invalidity, so a too-short credential
    // is reported the same way rather than as a distinct, probe-able error.
    return { ok: true, value: null };
  }

  let data: unknown;
  let error: unknown;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const response = await supabase.rpc("validate_kiosk_device_credential", {
      p_raw_credential: rawCredential,
    });
    data = response.data;
    error = response.error;
  } catch {
    return { ok: false, reason: "database_error" };
  }

  return parseValidatedDeviceCredential(data, error);
}

/* ===========================================================================
 * Shared helper
 * ======================================================================== */

/**
 * Maps an unexpected thrown value to a safe failure reason.
 *
 * Exposed for route handlers that wrap several calls in one try/catch and still
 * need to answer with a generic, non-revealing reason.
 */
export function toSafeFailure<T>(thrown: unknown): EnrollmentResult<T> {
  return { ok: false, reason: mapDatabaseError(thrown) };
}
