import { describe, expect, it } from "vitest";

import {
  ENROLLMENT_SESSION_STATUSES,
  ENROLLMENT_TTL_DEFAULT_MINUTES,
  ENROLLMENT_TTL_MAX_MINUTES,
  ENROLLMENT_TTL_MIN_MINUTES,
  REVOKE_OUTCOMES,
  deviceEnrollmentOutcome,
  enrollmentFailureMessage,
  enrollmentFailureStatus,
  isValidEnrollmentTtl,
  mapDatabaseError,
  parseEnrollmentSessionDetails,
  parseExchangedEnrollment,
  parseIssuedEnrollmentSession,
  parseMarkOpenedResult,
  parseRevokeEnrollmentSessionResult,
  parseValidatedDeviceCredential,
  unwrapSingleRow,
} from "./enrollment-contracts";

const VALID_TIMESTAMP = "2026-08-05T10:00:00.000Z";
const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

// ---------------------------------------------------------------------------
// unwrapSingleRow — the core PostgREST RETURNS TABLE defence
// ---------------------------------------------------------------------------

describe("unwrapSingleRow", () => {
  it("unwraps a single-row array (the normal PostgREST RETURNS TABLE shape)", () => {
    const result = unwrapSingleRow([{ a: 1 }], null);
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("accepts a bare object (scalar RPC or future contract change)", () => {
    const result = unwrapSingleRow({ a: 1 }, null);
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("returns null for an empty array (legitimate zero rows)", () => {
    const result = unwrapSingleRow([], null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null for null data (no rows at all)", () => {
    const result = unwrapSingleRow(null, null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null for undefined data", () => {
    const result = unwrapSingleRow(undefined, null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("refuses a multi-row array — picking one would be guessing", () => {
    const result = unwrapSingleRow([{ a: 1 }, { a: 2 }], null);
    expect(result).toEqual({ ok: false, reason: "multiple_rows" });
  });

  it.each([
    ["a string", "not-an-object"],
    ["a number", 42],
    ["a null element", [null]],
  ])("rejects %s as malformed_row", (_label, payload) => {
    const result = unwrapSingleRow(payload, null);
    expect(result).toEqual({ ok: false, reason: "malformed_row" });
  });

  it("rejects an array of strings as multiple_rows (2 elements, not malformed)", () => {
    const result = unwrapSingleRow(["a", "b"], null);
    expect(result).toEqual({ ok: false, reason: "multiple_rows" });
  });

  it("maps a database error through mapDatabaseError", () => {
    const result = unwrapSingleRow(null, {
      message: "Not authorized",
    });
    expect(result).toEqual({ ok: false, reason: "not_authorized" });
  });
});

// ---------------------------------------------------------------------------
// mapDatabaseError — exact message matching against committed RPC strings
// ---------------------------------------------------------------------------

describe("mapDatabaseError", () => {
  it("classifies 'Too many requests' as rate_limited", () => {
    expect(mapDatabaseError({ message: "Too many requests, please retry shortly" })).toBe(
      "rate_limited"
    );
  });

  it("classifies 'Not authorized' as not_authorized", () => {
    expect(mapDatabaseError({ message: "Not authorized" })).toBe("not_authorized");
  });

  it("classifies 'Invalid expiration window' as invalid_ttl", () => {
    expect(mapDatabaseError({ message: "Invalid expiration window" })).toBe("invalid_ttl");
  });

  it("classifies 'Invalid or expired setup link' as invalid_link", () => {
    expect(mapDatabaseError({ message: "Invalid or expired setup link" })).toBe("invalid_link");
  });

  it("falls back to database_error for unrecognised messages", () => {
    expect(mapDatabaseError({ message: "relation does not exist" })).toBe("database_error");
  });

  it("falls back to database_error for non-object errors", () => {
    expect(mapDatabaseError("some string")).toBe("database_error");
    expect(mapDatabaseError(null)).toBe("database_error");
    expect(mapDatabaseError(undefined)).toBe("database_error");
  });

  it("falls back to database_error for errors without a message property", () => {
    expect(mapDatabaseError({ code: "42P01" })).toBe("database_error");
  });

  it("is case-insensitive", () => {
    expect(mapDatabaseError({ message: "TOO MANY REQUESTS, PLEASE RETRY SHORTLY" })).toBe(
      "rate_limited"
    );
    expect(mapDatabaseError({ message: "NOT AUTHORIZED" })).toBe("not_authorized");
  });
});

// ---------------------------------------------------------------------------
// TTL validation — reject, do not clamp
// ---------------------------------------------------------------------------

describe("isValidEnrollmentTtl", () => {
  it("accepts the default TTL", () => {
    expect(isValidEnrollmentTtl(ENROLLMENT_TTL_DEFAULT_MINUTES)).toBe(true);
  });

  it("accepts the minimum", () => {
    expect(isValidEnrollmentTtl(ENROLLMENT_TTL_MIN_MINUTES)).toBe(true);
  });

  it("accepts the maximum", () => {
    expect(isValidEnrollmentTtl(ENROLLMENT_TTL_MAX_MINUTES)).toBe(true);
  });

  it.each([4, 0, -1, 31, 60, 120])("rejects %d (out of band)", (n) => {
    expect(isValidEnrollmentTtl(n)).toBe(false);
  });

  it.each([5.5, NaN, Infinity, -Infinity])("rejects non-integer %s", (n) => {
    expect(isValidEnrollmentTtl(n)).toBe(false);
  });

  it.each([null, undefined, "20", "5", true, {}, []])("rejects non-number %s", (v) => {
    expect(isValidEnrollmentTtl(v)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseIssuedEnrollmentSession — issue AND regenerate
// ---------------------------------------------------------------------------

describe("parseIssuedEnrollmentSession", () => {
  const validRow = {
    session_id: VALID_UUID,
    raw_token: "tok_abc123def456",
    expires_at: VALID_TIMESTAMP,
    superseded_previous: false,
  };

  it("parses a valid single-row array", () => {
    const result = parseIssuedEnrollmentSession([validRow]);
    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: VALID_UUID,
        rawToken: "tok_abc123def456",
        expiresAt: VALID_TIMESTAMP,
        supersededPrevious: false,
      },
    });
  });

  it("parses a valid bare object", () => {
    const result = parseIssuedEnrollmentSession(validRow);
    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: VALID_UUID,
        rawToken: "tok_abc123def456",
        expiresAt: VALID_TIMESTAMP,
        supersededPrevious: false,
      },
    });
  });

  it("reports supersededPrevious: true when the RPC says so", () => {
    const result = parseIssuedEnrollmentSession([
      { ...validRow, superseded_previous: true },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.supersededPrevious).toBe(true);
    }
  });

  // ---- Defect guards: blank link / N/A expiry ----

  it("rejects a missing session_id (no blank link)", () => {
    const { session_id: _, ...noId } = validRow;
    expect(parseIssuedEnrollmentSession([noId])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects an empty raw_token (no blank link)", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, raw_token: "" }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("rejects a whitespace-only raw_token", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, raw_token: "   " }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("rejects a null raw_token", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, raw_token: null }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("rejects a missing expires_at (no N/A expiry)", () => {
    const { expires_at: _, ...noExpiry } = validRow;
    expect(parseIssuedEnrollmentSession([noExpiry])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects an unparseable expires_at", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, expires_at: "not-a-date" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects a null expires_at", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, expires_at: null }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("rejects an absent superseded_previous (contract break)", () => {
    const { superseded_previous: _, ...noSuperseded } = validRow;
    expect(parseIssuedEnrollmentSession([noSuperseded])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects a non-boolean superseded_previous", () => {
    expect(
      parseIssuedEnrollmentSession([{ ...validRow, superseded_previous: "yes" }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  // ---- Edge cases ----

  it("reports no_rows for an empty array", () => {
    expect(parseIssuedEnrollmentSession([])).toEqual({
      ok: false,
      reason: "no_rows",
    });
  });

  it("reports no_rows for null data", () => {
    expect(parseIssuedEnrollmentSession(null)).toEqual({
      ok: false,
      reason: "no_rows",
    });
  });

  it("reports multiple_rows for ambiguous data", () => {
    expect(parseIssuedEnrollmentSession([validRow, validRow])).toEqual({
      ok: false,
      reason: "multiple_rows",
    });
  });

  it("maps a database error", () => {
    expect(
      parseIssuedEnrollmentSession(null, { message: "Too many requests, please retry shortly" })
    ).toEqual({ ok: false, reason: "rate_limited" });
  });
});

// ---------------------------------------------------------------------------
// parseEnrollmentSessionDetails — safe metadata, no token
// ---------------------------------------------------------------------------

describe("parseEnrollmentSessionDetails", () => {
  const validRow = {
    session_id: VALID_UUID,
    status: "active",
    expires_at: VALID_TIMESTAMP,
    opened_at: null,
    used_at: null,
    revoked_at: null,
    created_at: VALID_TIMESTAMP,
    created_by: VALID_UUID_2,
  };

  it("parses a valid active session", () => {
    const result = parseEnrollmentSessionDetails([validRow]);
    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: VALID_UUID,
        status: "active",
        expiresAt: VALID_TIMESTAMP,
        openedAt: null,
        usedAt: null,
        revokedAt: null,
        createdAt: VALID_TIMESTAMP,
        createdBy: VALID_UUID_2,
      },
    });
  });

  // ---- Discrepancy 2: the 'opened' status ----

  it("accepts the 'opened' status (the 5th value the handoff missed)", () => {
    const result = parseEnrollmentSessionDetails([
      { ...validRow, status: "opened", opened_at: VALID_TIMESTAMP },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value!.status).toBe("opened");
      expect(result.value!.openedAt).toBe(VALID_TIMESTAMP);
    }
  });

  it.each(ENROLLMENT_SESSION_STATUSES)("accepts status '%s'", (status) => {
    const row: Record<string, unknown> = { ...validRow, status };
    if (status === "opened") row.opened_at = VALID_TIMESTAMP;
    if (status === "used") row.used_at = VALID_TIMESTAMP;
    if (status === "revoked") row.revoked_at = VALID_TIMESTAMP;
    if (status === "expired") { /* expired is time-based, no extra column */ }

    const result = parseEnrollmentSessionDetails([row]);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown status value", () => {
    expect(
      parseEnrollmentSessionDetails([{ ...validRow, status: "unknown_status" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  // ---- Null for no session (Draft kiosk) ----

  it("returns null for a kiosk with no session (Draft state)", () => {
    const result = parseEnrollmentSessionDetails([]);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null for null data", () => {
    const result = parseEnrollmentSessionDetails(null);
    expect(result).toEqual({ ok: true, value: null });
  });

  // ---- Field validation ----

  it("rejects a missing session_id", () => {
    const { session_id: _, ...noId } = validRow;
    expect(parseEnrollmentSessionDetails([noId])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects an unparseable expires_at", () => {
    expect(
      parseEnrollmentSessionDetails([{ ...validRow, expires_at: "garbage" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects an unparseable created_at", () => {
    expect(
      parseEnrollmentSessionDetails([{ ...validRow, created_at: "garbage" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects a missing created_by", () => {
    const { created_by: _, ...noCreator } = validRow;
    expect(parseEnrollmentSessionDetails([noCreator])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("accepts nullable timestamps as null", () => {
    const result = parseEnrollmentSessionDetails([
      { ...validRow, opened_at: null, used_at: null, revoked_at: null },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value!.openedAt).toBeNull();
      expect(result.value!.usedAt).toBeNull();
      expect(result.value!.revokedAt).toBeNull();
    }
  });

  it("accepts nullable timestamps as valid dates", () => {
    const result = parseEnrollmentSessionDetails([
      {
        ...validRow,
        opened_at: VALID_TIMESTAMP,
        used_at: VALID_TIMESTAMP,
        revoked_at: VALID_TIMESTAMP,
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value!.openedAt).toBe(VALID_TIMESTAMP);
      expect(result.value!.usedAt).toBe(VALID_TIMESTAMP);
      expect(result.value!.revokedAt).toBe(VALID_TIMESTAMP);
    }
  });

  it("rejects an unparseable nullable timestamp", () => {
    expect(
      parseEnrollmentSessionDetails([{ ...validRow, opened_at: "not-a-date" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });
});

// ---------------------------------------------------------------------------
// parseRevokeEnrollmentSessionResult — truthful outcomes
// ---------------------------------------------------------------------------

describe("parseRevokeEnrollmentSessionResult", () => {
  it("parses a successful revoke", () => {
    const result = parseRevokeEnrollmentSessionResult([
      { outcome: "revoked", session_id: VALID_UUID },
    ]);
    expect(result).toEqual({
      ok: true,
      value: { outcome: "revoked", sessionId: VALID_UUID },
    });
  });

  // ---- Discrepancy 3: outcome is 'revoked', not 'revoked_now' ----

  it("accepts 'revoked' (not 'revoked_now' as the handoff claimed)", () => {
    const result = parseRevokeEnrollmentSessionResult([
      { outcome: "revoked", session_id: VALID_UUID },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects 'revoked_now' (the handoff's incorrect value)", () => {
    expect(
      parseRevokeEnrollmentSessionResult([
        { outcome: "revoked_now", session_id: VALID_UUID },
      ])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it.each(REVOKE_OUTCOMES)("accepts outcome '%s'", (outcome) => {
    const sessionId = outcome === "no_active_session" ? null : VALID_UUID;
    const result = parseRevokeEnrollmentSessionResult([
      { outcome, session_id: sessionId },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown outcome", () => {
    expect(
      parseRevokeEnrollmentSessionResult([
        { outcome: "expired", session_id: VALID_UUID },
      ])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects a non-string outcome", () => {
    expect(
      parseRevokeEnrollmentSessionResult([{ outcome: true, session_id: VALID_UUID }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("requires session_id for every outcome except no_active_session", () => {
    expect(
      parseRevokeEnrollmentSessionResult([
        { outcome: "revoked", session_id: null },
      ])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("allows null session_id for no_active_session", () => {
    const result = parseRevokeEnrollmentSessionResult([
      { outcome: "no_active_session", session_id: null },
    ]);
    expect(result).toEqual({
      ok: true,
      value: { outcome: "no_active_session", sessionId: null },
    });
  });

  it("rejects zero rows", () => {
    expect(parseRevokeEnrollmentSessionResult([])).toEqual({
      ok: false,
      reason: "no_rows",
    });
  });
});

// ---------------------------------------------------------------------------
// parseExchangedEnrollment — service_role only, credential must be present
// ---------------------------------------------------------------------------

describe("parseExchangedEnrollment", () => {
  const validRow = {
    kiosk_device_id: VALID_UUID,
    organization_id: VALID_UUID_2,
    device_name: "Lobby Kiosk",
    survey_id: null,
    default_language: null,
    branding: null,
    idle_timeout_seconds: null,
    raw_device_credential: "v2:credential-value",
  };

  it("parses a valid exchange result", () => {
    const result = parseExchangedEnrollment([validRow]);
    expect(result).toEqual({
      ok: true,
      value: {
        kioskDeviceId: VALID_UUID,
        organizationId: VALID_UUID_2,
        deviceName: "Lobby Kiosk",
        surveyId: null,
        defaultLanguage: null,
        branding: null,
        idleTimeoutSeconds: null,
        rawDeviceCredential: "v2:credential-value",
      },
    });
  });

  it("parses a row with all optional fields populated", () => {
    const result = parseExchangedEnrollment([
      {
        ...validRow,
        survey_id: VALID_UUID,
        default_language: "ar",
        branding: { primary_color: "#000" },
        idle_timeout_seconds: 120,
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.surveyId).toBe(VALID_UUID);
      expect(result.value.defaultLanguage).toBe("ar");
      expect(result.value.branding).toEqual({ primary_color: "#000" });
      expect(result.value.idleTimeoutSeconds).toBe(120);
    }
  });

  // ---- Credential must be present ----

  it("rejects a missing raw_device_credential", () => {
    const { raw_device_credential: _, ...noCred } = validRow;
    expect(parseExchangedEnrollment([noCred])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects an empty raw_device_credential", () => {
    expect(
      parseExchangedEnrollment([{ ...validRow, raw_device_credential: "" }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  it("rejects a null raw_device_credential", () => {
    expect(
      parseExchangedEnrollment([{ ...validRow, raw_device_credential: null }])
    ).toEqual({ ok: false, reason: "missing_field" });
  });

  // ---- Required fields ----

  it("rejects a missing kiosk_device_id", () => {
    const { kiosk_device_id: _, ...noId } = validRow;
    expect(parseExchangedEnrollment([noId])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects a missing organization_id", () => {
    const { organization_id: _, ...noOrg } = validRow;
    expect(parseExchangedEnrollment([noOrg])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects a missing device_name", () => {
    const { device_name: _, ...noName } = validRow;
    expect(parseExchangedEnrollment([noName])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  // ---- Nullable fields ----

  it("accepts null survey_id", () => {
    const result = parseExchangedEnrollment([{ ...validRow, survey_id: null }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.surveyId).toBeNull();
  });

  it("accepts null default_language", () => {
    const result = parseExchangedEnrollment([{ ...validRow, default_language: null }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.defaultLanguage).toBeNull();
  });

  it("accepts null idle_timeout_seconds", () => {
    const result = parseExchangedEnrollment([{ ...validRow, idle_timeout_seconds: null }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.idleTimeoutSeconds).toBeNull();
  });

  it("rejects a non-numeric idle_timeout_seconds", () => {
    expect(
      parseExchangedEnrollment([{ ...validRow, idle_timeout_seconds: "120" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  // ---- Error mapping ----

  it("maps invalid_link for null data (token not found)", () => {
    expect(parseExchangedEnrollment(null)).toEqual({
      ok: false,
      reason: "invalid_link",
    });
  });

  it("maps invalid_link for empty array", () => {
    expect(parseExchangedEnrollment([])).toEqual({
      ok: false,
      reason: "invalid_link",
    });
  });

  it("maps database error through mapDatabaseError", () => {
    expect(
      parseExchangedEnrollment(null, { message: "Invalid or expired setup link" })
    ).toEqual({ ok: false, reason: "invalid_link" });
  });
});

// ---------------------------------------------------------------------------
// parseValidatedDeviceCredential — zero rows = invalid (Discrepancy 1)
// ---------------------------------------------------------------------------

describe("parseValidatedDeviceCredential", () => {
  const validRow = {
    kiosk_device_id: VALID_UUID,
    organization_id: VALID_UUID_2,
    credential_version: 2,
  };

  it("parses a valid v2 credential", () => {
    const result = parseValidatedDeviceCredential([validRow]);
    expect(result).toEqual({
      ok: true,
      value: {
        kioskDeviceId: VALID_UUID,
        organizationId: VALID_UUID_2,
        credentialVersion: 2,
      },
    });
  });

  it("parses a legacy v1 credential", () => {
    const result = parseValidatedDeviceCredential([
      { ...validRow, credential_version: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value!.credentialVersion).toBe(1);
    }
  });

  // ---- Discrepancy 1: no is_valid column, zero rows = invalid ----

  it("returns null for zero rows (invalid credential, not an error)", () => {
    const result = parseValidatedDeviceCredential([]);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null for null data", () => {
    const result = parseValidatedDeviceCredential(null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("rejects credential_version 0 (not a valid version)", () => {
    expect(
      parseValidatedDeviceCredential([{ ...validRow, credential_version: 0 }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects credential_version 3 (unknown future version)", () => {
    expect(
      parseValidatedDeviceCredential([{ ...validRow, credential_version: 3 }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects a non-numeric credential_version", () => {
    expect(
      parseValidatedDeviceCredential([{ ...validRow, credential_version: "2" }])
    ).toEqual({ ok: false, reason: "invalid_field" });
  });

  it("rejects a missing kiosk_device_id", () => {
    const { kiosk_device_id: _, ...noId } = validRow;
    expect(parseValidatedDeviceCredential([noId])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });

  it("rejects a missing organization_id", () => {
    const { organization_id: _, ...noOrg } = validRow;
    expect(parseValidatedDeviceCredential([noOrg])).toEqual({
      ok: false,
      reason: "missing_field",
    });
  });
});

// ---------------------------------------------------------------------------
// parseMarkOpenedResult — the one scalar RPC
// ---------------------------------------------------------------------------

describe("parseMarkOpenedResult", () => {
  it("returns true for true", () => {
    expect(parseMarkOpenedResult(true)).toEqual({ ok: true, value: true });
  });

  it("returns true for false (opened marker failed, but that is a valid response)", () => {
    expect(parseMarkOpenedResult(false)).toEqual({ ok: true, value: false });
  });

  it("rejects a non-boolean as malformed", () => {
    expect(parseMarkOpenedResult("true")).toEqual({
      ok: false,
      reason: "malformed_row",
    });
  });

  it("rejects null as malformed", () => {
    expect(parseMarkOpenedResult(null)).toEqual({
      ok: false,
      reason: "malformed_row",
    });
  });

  it("maps a database error", () => {
    expect(parseMarkOpenedResult(null, { message: "Not authorized" })).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });
});

// ---------------------------------------------------------------------------
// enrollmentFailureMessage — safe admin copy
// ---------------------------------------------------------------------------

describe("enrollmentFailureMessage", () => {
  const reasons = [
    "database_error",
    "not_authorized",
    "rate_limited",
    "invalid_ttl",
    "invalid_link",
    "no_rows",
    "multiple_rows",
    "malformed_row",
    "missing_field",
    "invalid_field",
  ] as const;

  it("returns non-empty copy for every reason", () => {
    for (const reason of reasons) {
      const message = enrollmentFailureMessage(reason);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("never leaks database internals", () => {
    for (const reason of reasons) {
      const message = enrollmentFailureMessage(reason);
      expect(message.toLowerCase()).not.toContain("postgres");
      expect(message.toLowerCase()).not.toContain("supabase");
      expect(message.toLowerCase()).not.toContain("rpc");
      expect(message.toLowerCase()).not.toContain("sql");
      expect(message).not.toContain("null");
      expect(message).not.toContain("undefined");
    }
  });

  it("never implies success", () => {
    for (const reason of reasons) {
      const message = enrollmentFailureMessage(reason).toLowerCase();
      expect(message).not.toContain("ready");
      expect(message).not.toContain("success");
      expect(message).not.toContain("active");
    }
  });

  it("never reveals whether a kiosk or organization exists", () => {
    for (const reason of reasons) {
      const message = enrollmentFailureMessage(reason).toLowerCase();
      expect(message).not.toContain("kiosk");
      expect(message).not.toContain("organization");
    }
  });
});

// ---------------------------------------------------------------------------
// enrollmentFailureStatus — HTTP status codes
// ---------------------------------------------------------------------------

describe("enrollmentFailureStatus", () => {
  it("returns 403 for not_authorized", () => {
    expect(enrollmentFailureStatus("not_authorized")).toBe(403);
  });

  it("returns 429 for rate_limited", () => {
    expect(enrollmentFailureStatus("rate_limited")).toBe(429);
  });

  it("returns 400 for invalid_ttl", () => {
    expect(enrollmentFailureStatus("invalid_ttl")).toBe(400);
  });

  it("returns 400 for invalid_link", () => {
    expect(enrollmentFailureStatus("invalid_link")).toBe(400);
  });

  it("returns 500 for all other reasons", () => {
    expect(enrollmentFailureStatus("database_error")).toBe(500);
    expect(enrollmentFailureStatus("no_rows")).toBe(500);
    expect(enrollmentFailureStatus("multiple_rows")).toBe(500);
    expect(enrollmentFailureStatus("malformed_row")).toBe(500);
    expect(enrollmentFailureStatus("missing_field")).toBe(500);
    expect(enrollmentFailureStatus("invalid_field")).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// deviceEnrollmentOutcome — collapsed iPad-facing states
// ---------------------------------------------------------------------------

describe("deviceEnrollmentOutcome", () => {
  it("returns 'rate_limited' for rate_limited", () => {
    expect(deviceEnrollmentOutcome("rate_limited")).toBe("rate_limited");
  });

  it("returns 'invalid_link' for invalid_link", () => {
    expect(deviceEnrollmentOutcome("invalid_link")).toBe("invalid_link");
  });

  it("returns 'invalid_link' for not_authorized (no oracle)", () => {
    expect(deviceEnrollmentOutcome("not_authorized")).toBe("invalid_link");
  });

  it("returns 'failed' for all other reasons (no oracle)", () => {
    expect(deviceEnrollmentOutcome("database_error")).toBe("failed");
    expect(deviceEnrollmentOutcome("invalid_ttl")).toBe("failed");
    expect(deviceEnrollmentOutcome("no_rows")).toBe("failed");
    expect(deviceEnrollmentOutcome("multiple_rows")).toBe("failed");
    expect(deviceEnrollmentOutcome("malformed_row")).toBe("failed");
    expect(deviceEnrollmentOutcome("missing_field")).toBe("failed");
    expect(deviceEnrollmentOutcome("invalid_field")).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Constant integrity
// ---------------------------------------------------------------------------

describe("ENROLLMENT_SESSION_STATUSES", () => {
  it("contains exactly 5 values (not 4 as the handoff claimed)", () => {
    expect(ENROLLMENT_SESSION_STATUSES).toHaveLength(5);
  });

  it("includes 'opened' (the 5th value the handoff missed)", () => {
    expect(ENROLLMENT_SESSION_STATUSES).toContain("opened");
  });

  it("includes all 5 expected values", () => {
    expect(ENROLLMENT_SESSION_STATUSES).toEqual([
      "used",
      "revoked",
      "expired",
      "opened",
      "active",
    ]);
  });
});

describe("REVOKE_OUTCOMES", () => {
  it("contains exactly 5 values", () => {
    expect(REVOKE_OUTCOMES).toHaveLength(5);
  });

  it("contains 'revoked' not 'revoked_now'", () => {
    expect(REVOKE_OUTCOMES).toContain("revoked");
    expect(REVOKE_OUTCOMES).not.toContain("revoked_now");
  });

  it("contains 'already_expired' not 'expired'", () => {
    expect(REVOKE_OUTCOMES).toContain("already_expired");
    expect(REVOKE_OUTCOMES).not.toContain("expired");
  });
});

describe("TTL constants", () => {
  it("has a minimum of 5 (not 15 as the handoff claimed)", () => {
    expect(ENROLLMENT_TTL_MIN_MINUTES).toBe(5);
  });

  it("has a maximum of 30", () => {
    expect(ENROLLMENT_TTL_MAX_MINUTES).toBe(30);
  });

  it("has a default of 20", () => {
    expect(ENROLLMENT_TTL_DEFAULT_MINUTES).toBe(20);
  });
});