/**
 * Verified contracts for the kiosk secure-enrollment RPCs.
 *
 * Every signature, column name, status value and error string below was read
 * directly out of the committed migrations at HEAD `0c93d97`:
 *
 *   supabase/migrations/20260802090000_kiosk_enrollment_sessions.sql
 *   supabase/migrations/20260802100000_kiosk_enrollment_rpcs.sql
 *
 * It was NOT taken from KIOSK_PHASE3_APP_UI_HANDOFF.md. The handoff is wrong
 * in five places that would each have produced a defect, so the discrepancies
 * are recorded here rather than silently corrected:
 *
 *  1. `validate_kiosk_device_credential` — the handoff documents a third
 *     return column `is_valid boolean`. It does not exist. The function
 *     `RETURNS TABLE (kiosk_device_id, organization_id, credential_version
 *     smallint)` and signals invalidity by returning ZERO ROWS. Code reading
 *     `row.is_valid` would get `undefined`, and treating that as falsy would
 *     have rejected every valid credential.
 *
 *  2. `get_kiosk_enrollment_session_details.status` — the handoff lists four
 *     values (active | expired | used | revoked). The SQL emits FIVE; it also
 *     returns 'opened' when `opened_at is not null`. A four-member union would
 *     have failed validation exactly when an administrator watched the iPad
 *     open the link, i.e. in the normal path.
 *
 *  3. `revoke_kiosk_enrollment_session.outcome` — the handoff says the success
 *     value is `revoked_now`. The SQL returns `revoked`. It also returns
 *     `already_expired`, not `expired`.
 *
 *  4. TTL handling — the handoff says the TTL is "clamped to the 15-30 minute
 *     band". It is not clamped, it is REJECTED: `p_ttl_minutes` outside 5..30
 *     raises 'Invalid expiration window'. The floor is 5, not 15. Sending an
 *     out-of-band value fails the request instead of being quietly corrected.
 *
 *  5. Rate limiting — the handoff (§19) states none was implemented. Two
 *     database-level limits DO exist and both surface as raised exceptions the
 *     API layer must map, or they would appear to an operator as a generic
 *     500:
 *       - issuance: >= 5 sessions for one device within 5 minutes raises
 *         'Too many requests, please retry shortly';
 *       - exchange: `exchange_attempt_count > 20` on the resolved session
 *         raises the generic setup-link failure.
 *     Application-boundary rate limiting therefore COMPLEMENTS these; it does
 *     not substitute for them.
 *
 * Also verified against the SQL, and relevant to the credential model:
 * `exchange_kiosk_enrollment_token` does NOT leave `access_token` null as the
 * handoff §9 claims. That column is NOT NULL + UNIQUE, so the RPC writes
 * non-secret filler `'v2:' || uuid` and sets `credential_version = 2`. The
 * filler is explicitly rejected as a credential by
 * `validate_kiosk_device_credential`, so it cannot be replayed. Recognition of
 * a legacy device is `credential_version = 1`, not "access_token is non-null".
 *
 * ---------------------------------------------------------------------------
 * PostgREST shape
 * ---------------------------------------------------------------------------
 * All of these except `mark_kiosk_enrollment_session_opened` are declared
 * `RETURNS TABLE`, so supabase-js resolves `data` to an ARRAY OF ROWS. Reading
 * `data.raw_token` instead of `data[0].raw_token` is precisely the defect that
 * commit 9958c4e fixed for activation and that produced the blank Activation
 * Code and `N/A` expiry in the reference screenshot. Nothing in this module
 * casts an RPC payload to an application type; every field is validated.
 */

/** Why an RPC payload could not be accepted. Never shown raw to a user. */
export type EnrollmentFailureReason =
  | "database_error"
  | "not_authorized"
  | "rate_limited"
  | "invalid_ttl"
  | "invalid_link"
  | "no_rows"
  | "multiple_rows"
  | "malformed_row"
  | "missing_field"
  | "invalid_field";

export type EnrollmentResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: EnrollmentFailureReason };

/* ===========================================================================
 * Return shapes — one per committed RPC
 * ======================================================================== */

/** `issue_kiosk_enrollment_session(uuid, integer)` — serves issue AND regenerate. */
export type IssuedEnrollmentSession = {
  sessionId: string;
  /** Returned exactly once by the database. Never persisted, never logged. */
  rawToken: string;
  expiresAt: string;
  supersededPrevious: boolean;
};

/**
 * `get_kiosk_enrollment_session_details(uuid).status`.
 * Five values, ordered as the SQL CASE evaluates them.
 */
export const ENROLLMENT_SESSION_STATUSES = [
  "used",
  "revoked",
  "expired",
  "opened",
  "active",
] as const;

export type EnrollmentSessionStatus =
  (typeof ENROLLMENT_SESSION_STATUSES)[number];

/**
 * Administrator-safe metadata. Carries no token and no token hash — there is
 * deliberately no path back to the raw token from this RPC.
 */
export type EnrollmentSessionDetails = {
  sessionId: string;
  status: EnrollmentSessionStatus;
  expiresAt: string;
  openedAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
};

/** `revoke_kiosk_enrollment_session(uuid).outcome` — truthful, never a bare true. */
export const REVOKE_OUTCOMES = [
  "revoked",
  "already_revoked",
  "already_used",
  "already_expired",
  "no_active_session",
] as const;

export type RevokeOutcome = (typeof REVOKE_OUTCOMES)[number];

export type RevokeEnrollmentSessionResult = {
  outcome: RevokeOutcome;
  /** Null only for `no_active_session`; the SQL returns `null::uuid` there. */
  sessionId: string | null;
};

/** `exchange_kiosk_enrollment_token(text)` — service_role only. */
export type ExchangedEnrollment = {
  kioskDeviceId: string;
  organizationId: string;
  deviceName: string;
  surveyId: string | null;
  defaultLanguage: string | null;
  branding: unknown;
  idleTimeoutSeconds: number | null;
  /** Returned exactly once. Only its hash is stored. Never logged. */
  rawDeviceCredential: string;
};

/** `validate_kiosk_device_credential(text)` — zero rows means invalid. */
export type ValidatedDeviceCredential = {
  kioskDeviceId: string;
  organizationId: string;
  /** 1 = legacy plaintext. 2 = hash-only. */
  credentialVersion: 1 | 2;
};

/* ===========================================================================
 * TTL — reject, do not clamp
 * ======================================================================== */

/** Inclusive bounds enforced by the SQL. Outside this range the RPC raises. */
export const ENROLLMENT_TTL_MIN_MINUTES = 5;
export const ENROLLMENT_TTL_MAX_MINUTES = 30;
export const ENROLLMENT_TTL_DEFAULT_MINUTES = 20;

/**
 * Validates a TTL before it reaches the database.
 *
 * Deliberately rejects rather than clamping: clamping would tell an operator
 * their 60-minute request succeeded while silently issuing 30, and the SQL
 * itself rejects, so clamping here would only mask the disagreement.
 */
export function isValidEnrollmentTtl(minutes: unknown): minutes is number {
  return (
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= ENROLLMENT_TTL_MIN_MINUTES &&
    minutes <= ENROLLMENT_TTL_MAX_MINUTES
  );
}

/* ===========================================================================
 * Generic, defensive unwrapping
 * ======================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Unwraps a `RETURNS TABLE` payload to exactly one row.
 *
 * `allowEmpty` distinguishes the two legitimate zero-row cases from a fault:
 * `get_kiosk_enrollment_session_details` returns no rows for a kiosk that has
 * never had a session, and `validate_kiosk_device_credential` returns no rows
 * for an invalid credential. Neither is an error. Issuance returning no rows
 * IS an error.
 */
export function unwrapSingleRow(
  data: unknown,
  error: unknown
): EnrollmentResult<Record<string, unknown> | null> {
  if (error) return { ok: false, reason: mapDatabaseError(error) };
  if (data === null || data === undefined) return { ok: true, value: null };

  let row: unknown;
  if (Array.isArray(data)) {
    if (data.length === 0) return { ok: true, value: null };
    // Ambiguous: refuse rather than silently picking a row. Every RPC here is
    // LIMIT 1 or a single INSERT ... RETURNING, so >1 row means the contract
    // changed underneath us and guessing would be unsafe.
    if (data.length > 1) return { ok: false, reason: "multiple_rows" };
    row = data[0];
  } else {
    row = data;
  }

  if (!isRecord(row)) return { ok: false, reason: "malformed_row" };
  return { ok: true, value: row };
}

/** Non-empty string, else `missing_field`. */
function readString(
  row: Record<string, unknown>,
  key: string
): EnrollmentResult<string> {
  const raw = row[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "missing_field" };
  }
  return { ok: true, value: raw };
}

/** Nullable string; empty string is normalised to null. */
function readNullableString(
  row: Record<string, unknown>,
  key: string
): EnrollmentResult<string | null> {
  const raw = row[key];
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") return { ok: false, reason: "invalid_field" };
  return { ok: true, value: raw };
}

/** A parseable ISO timestamp. Guards against the `N/A` expiry defect. */
function readTimestamp(
  row: Record<string, unknown>,
  key: string
): EnrollmentResult<string> {
  const read = readString(row, key);
  if (!read.ok) return read;
  if (Number.isNaN(new Date(read.value).getTime())) {
    return { ok: false, reason: "invalid_field" };
  }
  return read;
}

function readNullableTimestamp(
  row: Record<string, unknown>,
  key: string
): EnrollmentResult<string | null> {
  const read = readNullableString(row, key);
  if (!read.ok) return read;
  if (read.value === null) return { ok: true, value: null };
  if (Number.isNaN(new Date(read.value).getTime())) {
    return { ok: false, reason: "invalid_field" };
  }
  return read;
}

/* ===========================================================================
 * Per-RPC parsers
 * ======================================================================== */

/**
 * Parses `issue_kiosk_enrollment_session`.
 *
 * Success requires a session id, a NON-EMPTY raw token and a PARSEABLE expiry
 * together. A partial row is refused, so the UI can never open a "ready" panel
 * showing a blank link or an `N/A` expiration — the two defects visible in the
 * reference screenshot.
 */
export function parseIssuedEnrollmentSession(
  data: unknown,
  error: unknown = null
): EnrollmentResult<IssuedEnrollmentSession> {
  const unwrapped = unwrapSingleRow(data, error);
  if (!unwrapped.ok) return unwrapped;
  if (unwrapped.value === null) return { ok: false, reason: "no_rows" };
  const row = unwrapped.value;

  const sessionId = readString(row, "session_id");
  if (!sessionId.ok) return sessionId;

  const rawToken = readString(row, "raw_token");
  if (!rawToken.ok) return rawToken;

  const expiresAt = readTimestamp(row, "expires_at");
  if (!expiresAt.ok) return expiresAt;

  // Absent boolean is a contract break, not a false.
  const superseded = row.superseded_previous;
  if (typeof superseded !== "boolean") {
    return { ok: false, reason: "missing_field" };
  }

  return {
    ok: true,
    value: {
      sessionId: sessionId.value,
      rawToken: rawToken.value,
      expiresAt: expiresAt.value,
      supersededPrevious: superseded,
    },
  };
}

/**
 * Parses `get_kiosk_enrollment_session_details`.
 *
 * Resolves to `null` for a kiosk with no session yet — a Draft kiosk, which is
 * a normal state and not a failure.
 */
export function parseEnrollmentSessionDetails(
  data: unknown,
  error: unknown = null
): EnrollmentResult<EnrollmentSessionDetails | null> {
  const unwrapped = unwrapSingleRow(data, error);
  if (!unwrapped.ok) return unwrapped;
  if (unwrapped.value === null) return { ok: true, value: null };
  const row = unwrapped.value;

  const sessionId = readString(row, "session_id");
  if (!sessionId.ok) return sessionId;

  const status = row.status;
  if (
    typeof status !== "string" ||
    !(ENROLLMENT_SESSION_STATUSES as readonly string[]).includes(status)
  ) {
    return { ok: false, reason: "invalid_field" };
  }

  const expiresAt = readTimestamp(row, "expires_at");
  if (!expiresAt.ok) return expiresAt;

  const openedAt = readNullableTimestamp(row, "opened_at");
  if (!openedAt.ok) return openedAt;

  const usedAt = readNullableTimestamp(row, "used_at");
  if (!usedAt.ok) return usedAt;

  const revokedAt = readNullableTimestamp(row, "revoked_at");
  if (!revokedAt.ok) return revokedAt;

  const createdAt = readTimestamp(row, "created_at");
  if (!createdAt.ok) return createdAt;

  const createdBy = readString(row, "created_by");
  if (!createdBy.ok) return createdBy;

  return {
    ok: true,
    value: {
      sessionId: sessionId.value,
      status: status as EnrollmentSessionStatus,
      expiresAt: expiresAt.value,
      openedAt: openedAt.value,
      usedAt: usedAt.value,
      revokedAt: revokedAt.value,
      createdAt: createdAt.value,
      createdBy: createdBy.value,
    },
  };
}

/**
 * Parses `revoke_kiosk_enrollment_session`.
 *
 * The outcome is reported verbatim so the UI states the truth: a link that was
 * already used must not be presented as "revoked". `session_id` is legitimately
 * null for `no_active_session` and required for every other outcome.
 */
export function parseRevokeEnrollmentSessionResult(
  data: unknown,
  error: unknown = null
): EnrollmentResult<RevokeEnrollmentSessionResult> {
  const unwrapped = unwrapSingleRow(data, error);
  if (!unwrapped.ok) return unwrapped;
  if (unwrapped.value === null) return { ok: false, reason: "no_rows" };
  const row = unwrapped.value;

  const outcome = row.outcome;
  if (
    typeof outcome !== "string" ||
    !(REVOKE_OUTCOMES as readonly string[]).includes(outcome)
  ) {
    return { ok: false, reason: "invalid_field" };
  }

  const sessionId = readNullableString(row, "session_id");
  if (!sessionId.ok) return sessionId;

  if (outcome !== "no_active_session" && sessionId.value === null) {
    return { ok: false, reason: "missing_field" };
  }

  return {
    ok: true,
    value: {
      outcome: outcome as RevokeOutcome,
      sessionId: sessionId.value,
    },
  };
}

/**
 * Parses `exchange_kiosk_enrollment_token`.
 *
 * The credential must be present and non-empty for this to succeed. An
 * enrollment is reported to the device ONLY when a usable credential actually
 * came back, never on the strength of an HTTP 200 alone.
 */
export function parseExchangedEnrollment(
  data: unknown,
  error: unknown = null
): EnrollmentResult<ExchangedEnrollment> {
  const unwrapped = unwrapSingleRow(data, error);
  if (!unwrapped.ok) return unwrapped;
  if (unwrapped.value === null) return { ok: false, reason: "invalid_link" };
  const row = unwrapped.value;

  const kioskDeviceId = readString(row, "kiosk_device_id");
  if (!kioskDeviceId.ok) return kioskDeviceId;

  const organizationId = readString(row, "organization_id");
  if (!organizationId.ok) return organizationId;

  const deviceName = readString(row, "device_name");
  if (!deviceName.ok) return deviceName;

  const surveyId = readNullableString(row, "survey_id");
  if (!surveyId.ok) return surveyId;

  const defaultLanguage = readNullableString(row, "default_language");
  if (!defaultLanguage.ok) return defaultLanguage;

  const rawDeviceCredential = readString(row, "raw_device_credential");
  if (!rawDeviceCredential.ok) return rawDeviceCredential;

  const idleRaw = row.idle_timeout_seconds;
  let idleTimeoutSeconds: number | null;
  if (idleRaw === null || idleRaw === undefined) {
    idleTimeoutSeconds = null;
  } else if (typeof idleRaw === "number" && Number.isFinite(idleRaw)) {
    idleTimeoutSeconds = idleRaw;
  } else {
    return { ok: false, reason: "invalid_field" };
  }

  return {
    ok: true,
    value: {
      kioskDeviceId: kioskDeviceId.value,
      organizationId: organizationId.value,
      deviceName: deviceName.value,
      surveyId: surveyId.value,
      defaultLanguage: defaultLanguage.value,
      // Opaque passthrough; shape is owned by the kiosk runtime, not by us.
      branding: row.branding ?? null,
      idleTimeoutSeconds,
      rawDeviceCredential: rawDeviceCredential.value,
    },
  };
}

/**
 * Parses `validate_kiosk_device_credential`.
 *
 * Resolves to `null` for an invalid credential, because the SQL signals
 * invalidity with ZERO ROWS and returns no `is_valid` column despite what the
 * handoff documents (see discrepancy 1 at the top of this file).
 */
export function parseValidatedDeviceCredential(
  data: unknown,
  error: unknown = null
): EnrollmentResult<ValidatedDeviceCredential | null> {
  const unwrapped = unwrapSingleRow(data, error);
  if (!unwrapped.ok) return unwrapped;
  if (unwrapped.value === null) return { ok: true, value: null };
  const row = unwrapped.value;

  const kioskDeviceId = readString(row, "kiosk_device_id");
  if (!kioskDeviceId.ok) return kioskDeviceId;

  const organizationId = readString(row, "organization_id");
  if (!organizationId.ok) return organizationId;

  const version = row.credential_version;
  if (version !== 1 && version !== 2) {
    return { ok: false, reason: "invalid_field" };
  }

  return {
    ok: true,
    value: {
      kioskDeviceId: kioskDeviceId.value,
      organizationId: organizationId.value,
      credentialVersion: version,
    },
  };
}

/**
 * Parses `mark_kiosk_enrollment_session_opened`, the one scalar RPC here.
 * A non-boolean payload is treated as "not opened" rather than as success.
 */
export function parseMarkOpenedResult(
  data: unknown,
  error: unknown = null
): EnrollmentResult<boolean> {
  if (error) return { ok: false, reason: mapDatabaseError(error) };
  if (typeof data !== "boolean") return { ok: false, reason: "malformed_row" };
  return { ok: true, value: data };
}

/* ===========================================================================
 * Error mapping
 * ======================================================================== */

/**
 * Classifies a raised database error by matching the exact message strings
 * emitted by the committed RPCs.
 *
 * Matching on message text is not elegant, but these RPCs raise plain
 * `raise exception` without a custom SQLSTATE, so the message is the only
 * signal available. The strings are asserted by the tests, so a future
 * migration that changes the wording fails a test rather than silently
 * degrading a 429 into a 500.
 */
export function mapDatabaseError(error: unknown): EnrollmentFailureReason {
  const message =
    isRecord(error) && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (message.includes("too many requests")) return "rate_limited";
  if (message.includes("not authorized")) return "not_authorized";
  if (message.includes("invalid expiration window")) return "invalid_ttl";
  if (message.includes("invalid or expired setup link")) return "invalid_link";
  return "database_error";
}

/**
 * Administrator-facing copy. No SQL state, no function or column name, no raw
 * PostgREST text — and nothing that hints whether a kiosk, organization or
 * token exists.
 */
const ADMIN_MESSAGES: Record<EnrollmentFailureReason, string> = {
  database_error:
    "Something went wrong preparing this setup link. Please try again in a moment.",
  not_authorized: "You do not have permission to manage this device.",
  rate_limited:
    "Too many setup links were requested for this device. Please wait a few minutes and try again.",
  invalid_ttl: "Choose an expiry between 5 and 30 minutes.",
  invalid_link: "This setup link is no longer valid. Generate a new one.",
  no_rows:
    "No setup link was issued, so nothing was changed. Please try again.",
  multiple_rows:
    "The setup response was unexpected and was not applied. Please try again.",
  malformed_row:
    "The setup response was incomplete and was not applied. Please try again.",
  missing_field:
    "The setup response was incomplete and was not applied. Please try again.",
  invalid_field:
    "The setup response could not be read and was not applied. Please try again.",
};

export function enrollmentFailureMessage(
  reason: EnrollmentFailureReason
): string {
  return ADMIN_MESSAGES[reason];
}

/** HTTP status for an administrator route. Never leaks existence. */
export function enrollmentFailureStatus(
  reason: EnrollmentFailureReason
): number {
  switch (reason) {
    case "not_authorized":
      // Unknown kiosk and forbidden kiosk are indistinguishable here, matching
      // the RPC, which raises the same 'Not authorized' for both.
      return 403;
    case "rate_limited":
      return 429;
    case "invalid_ttl":
      return 400;
    case "invalid_link":
      return 400;
    default:
      return 500;
  }
}

/**
 * Device-facing copy for the iPad. Deliberately collapses every failure
 * category into states that reveal nothing: an attacker probing tokens cannot
 * tell "unknown" from "expired", "revoked" or "already used", which is the
 * same no-oracle property the exchange RPC enforces in SQL.
 */
export type DeviceEnrollmentOutcome =
  | "enrolled"
  | "invalid_link"
  | "rate_limited"
  | "failed";

export function deviceEnrollmentOutcome(
  reason: EnrollmentFailureReason
): DeviceEnrollmentOutcome {
  if (reason === "rate_limited") return "rate_limited";
  if (reason === "invalid_link" || reason === "not_authorized") {
    return "invalid_link";
  }
  return "failed";
}
