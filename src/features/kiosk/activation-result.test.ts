import { describe, expect, it } from "vitest";

import {
  activationFailureMessage,
  canAdministerKioskActivation,
  parseActivationRpcResult,
} from "./activation-result";

const VALID_EXPIRY = "2026-08-05T10:00:00.000Z";

describe("parseActivationRpcResult", () => {
  // The defect: `regenerate_activation_code` is RETURNS TABLE, so PostgREST
  // sends an array. The old code cast it to an object, yielding `undefined`
  // for both fields -> blank Activation Code and "N/A" expiry.
  it("unwraps the single-row array PostgREST returns for a RETURNS TABLE RPC", () => {
    const result = parseActivationRpcResult([
      { activation_code: "ABC123", activation_code_expires_at: VALID_EXPIRY },
    ]);

    expect(result).toEqual({
      ok: true,
      code: "ABC123",
      expiresAt: VALID_EXPIRY,
    });
  });

  it("reproduces the old defect: a naive object cast loses every field", () => {
    const payload: unknown = [
      { activation_code: "ABC123", activation_code_expires_at: VALID_EXPIRY },
    ];

    // What the buggy code effectively did.
    const naive = payload as { activation_code?: string };
    expect(naive.activation_code).toBeUndefined();

    // What the fix does.
    const parsed = parseActivationRpcResult(payload);
    expect(parsed.ok).toBe(true);
  });

  it("accepts a bare object if the RPC is ever redefined to return a scalar", () => {
    const result = parseActivationRpcResult({
      activation_code: "XYZ789",
      activation_code_expires_at: VALID_EXPIRY,
    });

    expect(result).toEqual({
      ok: true,
      code: "XYZ789",
      expiresAt: VALID_EXPIRY,
    });
  });

  it("trims surrounding whitespace from the code", () => {
    const result = parseActivationRpcResult([
      { activation_code: "  ABC123  ", activation_code_expires_at: VALID_EXPIRY },
    ]);

    expect(result).toEqual({
      ok: true,
      code: "ABC123",
      expiresAt: VALID_EXPIRY,
    });
  });

  it("reports a database error without leaking the driver payload", () => {
    const result = parseActivationRpcResult(null, {
      message: 'relation "kiosk_devices" does not exist',
      code: "42P01",
    });

    expect(result).toEqual({ ok: false, reason: "database_error" });
    expect(activationFailureMessage("database_error")).not.toContain("42P01");
    expect(activationFailureMessage("database_error")).not.toContain("relation");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty array", []],
  ])("treats %s as zero rows", (_label, payload) => {
    expect(parseActivationRpcResult(payload)).toEqual({
      ok: false,
      reason: "no_rows",
    });
  });

  it("refuses an ambiguous multi-row response rather than picking one", () => {
    const result = parseActivationRpcResult([
      { activation_code: "AAA111", activation_code_expires_at: VALID_EXPIRY },
      { activation_code: "BBB222", activation_code_expires_at: VALID_EXPIRY },
    ]);

    expect(result).toEqual({ ok: false, reason: "multiple_rows" });
  });

  it.each([
    ["a string row", ["ABC123"]],
    ["a numeric row", [42]],
    ["a null row", [null]],
  ])("rejects %s as malformed", (_label, payload) => {
    expect(parseActivationRpcResult(payload)).toEqual({
      ok: false,
      reason: "malformed_row",
    });
  });

  it.each([
    ["an absent code", { activation_code_expires_at: VALID_EXPIRY }],
    ["a null code", { activation_code: null, activation_code_expires_at: VALID_EXPIRY }],
    ["an empty code", { activation_code: "", activation_code_expires_at: VALID_EXPIRY }],
    ["a whitespace code", { activation_code: "   ", activation_code_expires_at: VALID_EXPIRY }],
    ["a non-string code", { activation_code: 123456, activation_code_expires_at: VALID_EXPIRY }],
  ])("never reports success for %s (blank Activation Code defect)", (_label, row) => {
    expect(parseActivationRpcResult([row])).toEqual({
      ok: false,
      reason: "missing_code",
    });
  });

  it.each([
    ["an absent expiry", { activation_code: "ABC123" }],
    ["a null expiry", { activation_code: "ABC123", activation_code_expires_at: null }],
    ["an empty expiry", { activation_code: "ABC123", activation_code_expires_at: "" }],
  ])("never reports success for %s (N/A expiry defect)", (_label, row) => {
    expect(parseActivationRpcResult([row])).toEqual({
      ok: false,
      reason: "missing_expiry",
    });
  });

  it.each([
    ["an unparseable string", "not-a-date"],
    ["a numeric timestamp", 1735689600000],
  ])("rejects %s as an invalid expiry", (_label, expiry) => {
    expect(
      parseActivationRpcResult([
        { activation_code: "ABC123", activation_code_expires_at: expiry },
      ])
    ).toEqual({ ok: false, reason: "invalid_expiry" });
  });

  it("only reports success when BOTH the code and the expiry are usable", () => {
    const halfValid = parseActivationRpcResult([
      { activation_code: "ABC123", activation_code_expires_at: null },
    ]);
    expect(halfValid.ok).toBe(false);
  });
});

describe("activationFailureMessage", () => {
  const reasons = [
    "database_error",
    "no_rows",
    "multiple_rows",
    "malformed_row",
    "missing_code",
    "missing_expiry",
    "invalid_expiry",
  ] as const;

  it("returns safe, non-empty operator copy for every reason", () => {
    for (const reason of reasons) {
      const message = activationFailureMessage(reason);
      expect(message.length).toBeGreaterThan(0);
      // No internal database detail leaks to the administrator UI.
      expect(message.toLowerCase()).not.toContain("postgres");
      expect(message.toLowerCase()).not.toContain("supabase");
      expect(message.toLowerCase()).not.toContain("rpc");
      expect(message).not.toContain("regenerate_activation_code");
      expect(message).not.toContain("null");
    }
  });

  it("never implies the activation succeeded", () => {
    for (const reason of reasons) {
      expect(activationFailureMessage(reason).toLowerCase()).not.toContain("ready");
    }
  });
});

describe("canAdministerKioskActivation", () => {
  it.each([["organization_owner"], ["organization_admin"]])(
    "allows %s",
    (role) => {
      expect(canAdministerKioskActivation({ role })).toBe(true);
      expect(canAdministerKioskActivation({ role, status: "active" })).toBe(true);
    }
  );

  // Membership alone must NOT grant activation rights.
  it.each([
    ["member"],
    ["viewer"],
    ["analyst"],
    ["location_manager"],
    [""],
  ])("rejects the non-privileged role %s", (role) => {
    expect(canAdministerKioskActivation({ role })).toBe(false);
  });

  it("rejects a privileged role whose membership is not active", () => {
    expect(
      canAdministerKioskActivation({ role: "organization_admin", status: "suspended" })
    ).toBe(false);
    expect(
      canAdministerKioskActivation({ role: "organization_owner", status: "invited" })
    ).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s membership (no membership at all)", (_label, membership) => {
    expect(canAdministerKioskActivation(membership)).toBe(false);
  });

  it("rejects a malformed role value", () => {
    expect(canAdministerKioskActivation({ role: 1 })).toBe(false);
    expect(canAdministerKioskActivation({})).toBe(false);
  });
});
