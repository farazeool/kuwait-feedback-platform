/**
 * Typed validation for the `regenerate_activation_code` RPC response.
 *
 * The RPC is declared `RETURNS TABLE (activation_code text,
 * activation_code_expires_at timestamptz)`. PostgREST therefore serialises the
 * result as an ARRAY OF ROWS, not as a single object. The previous
 * implementation cast the payload straight to an object
 * (`activationData as ActivationCodeResult`), so both properties resolved to
 * `undefined` — which is the direct cause of the blank Activation Code and the
 * `N/A` expiry in the administrator UI.
 *
 * This module unwraps the array defensively and refuses to report success
 * unless exactly one well-formed row carrying BOTH a non-empty code and a
 * parseable expiry timestamp was returned.
 */

/** Why a generation attempt could not produce a usable activation record. */
export type ActivationFailureReason =
  | "database_error"
  | "no_rows"
  | "multiple_rows"
  | "malformed_row"
  | "missing_code"
  | "missing_expiry"
  | "invalid_expiry";

export type ActivationResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; reason: ActivationFailureReason };

/**
 * Administrator-facing copy. These strings intentionally never embed raw
 * Supabase / PostgREST error text, SQL state codes, function names or column
 * names, so an operator sees an actionable sentence instead of internal
 * database detail.
 */
const ADMIN_MESSAGES: Record<ActivationFailureReason, string> = {
  database_error:
    "Could not generate an activation code. Please try again in a moment.",
  no_rows:
    "No activation code was issued. The device may no longer be awaiting activation.",
  multiple_rows:
    "The activation response was unexpected and was not applied. Please try again.",
  malformed_row:
    "The activation response was incomplete and was not applied. Please try again.",
  missing_code:
    "The activation code could not be read, so it was not applied. Please try again.",
  missing_expiry:
    "The activation code has no expiry and was not applied. Please try again.",
  invalid_expiry:
    "The activation expiry could not be read, so it was not applied. Please try again.",
};

/** Maps a failure reason to safe administrator-facing copy. */
export function activationFailureMessage(
  reason: ActivationFailureReason
): string {
  return ADMIN_MESSAGES[reason];
}

/** Narrows an unknown value to a non-array object we can read keys from. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Unwraps and validates the RPC payload.
 *
 * Handles every response shape explicitly:
 *  - a database error                      -> `database_error`
 *  - null / undefined / an empty array     -> `no_rows`
 *  - more than one row                     -> `multiple_rows`
 *  - a non-object row                      -> `malformed_row`
 *  - a blank or non-string code            -> `missing_code`
 *  - an absent expiry                      -> `missing_expiry`
 *  - an unparseable expiry                 -> `invalid_expiry`
 *
 * A bare object (rather than an array) is also accepted so the helper stays
 * correct if the RPC is ever redefined to return a scalar composite.
 */
export function parseActivationRpcResult(
  data: unknown,
  error: unknown = null
): ActivationResult {
  if (error) {
    return { ok: false, reason: "database_error" };
  }

  if (data === null || data === undefined) {
    return { ok: false, reason: "no_rows" };
  }

  // `RETURNS TABLE` ⇒ PostgREST sends an array. Unwrap it rather than casting.
  let row: unknown;
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { ok: false, reason: "no_rows" };
    }
    if (data.length > 1) {
      // Ambiguous: refuse rather than silently picking a row.
      return { ok: false, reason: "multiple_rows" };
    }
    row = data[0];
  } else {
    row = data;
  }

  if (!isRecord(row)) {
    return { ok: false, reason: "malformed_row" };
  }

  const code = row.activation_code;
  if (typeof code !== "string" || code.trim() === "") {
    return { ok: false, reason: "missing_code" };
  }

  const expiresAt = row.activation_code_expires_at;
  if (expiresAt === null || expiresAt === undefined || expiresAt === "") {
    return { ok: false, reason: "missing_expiry" };
  }
  if (typeof expiresAt !== "string") {
    return { ok: false, reason: "invalid_expiry" };
  }
  if (Number.isNaN(new Date(expiresAt).getTime())) {
    return { ok: false, reason: "invalid_expiry" };
  }

  return { ok: true, code: code.trim(), expiresAt };
}

/**
 * Organization roles permitted to generate or manage kiosk activation details.
 *
 * This mirrors the authorization already enforced inside
 * `regenerate_activation_code` / `get_kiosk_activation_details`, so the API
 * layer rejects an under-privileged member before the RPC is ever reached
 * (defence in depth, and a clean 403 instead of a raised SQL exception).
 */
export const KIOSK_ADMIN_ROLES = [
  "organization_owner",
  "organization_admin",
] as const;

export type KioskAdminRole = (typeof KIOSK_ADMIN_ROLES)[number];

/**
 * True only for an ACTIVE membership holding a privileged role. A viewer,
 * analyst or any other member — and any member whose access was suspended —
 * must not be able to mint or revoke activation credentials.
 */
export function canAdministerKioskActivation(
  membership: { role?: unknown; status?: unknown } | null | undefined
): boolean {
  if (!membership) return false;

  const { role, status } = membership;
  if (typeof role !== "string") return false;

  // `status` is optional in older rows; when present it must be active.
  if (status !== undefined && status !== null && status !== "active") {
    return false;
  }

  return (KIOSK_ADMIN_ROLES as readonly string[]).includes(role);
}
