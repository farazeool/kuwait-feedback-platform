import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_MESSAGES,
  decideAssignmentSubmission,
  resolveAssignmentOutcome,
  type CreateAssignmentResult,
} from "./assignment-result";

const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEMPLATE_ID = "660e8400-e29b-41d4-a716-446655440000";

describe("decideAssignmentSubmission", () => {
  it("submits an employee/template payload when both selections are present", () => {
    const decision = decideAssignmentSubmission({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      isPending: false,
    });

    expect(decision).toEqual({
      action: "submit",
      payload: {
        kind: "fk",
        targetType: "employee",
        targetId: EMPLOYEE_ID,
        templateId: TEMPLATE_ID,
        surveyId: null,
        metadata: {},
      },
    });
  });

  it("rejects a second submission while one is already pending", () => {
    const decision = decideAssignmentSubmission({
      employeeId: EMPLOYEE_ID,
      templateId: TEMPLATE_ID,
      isPending: true,
    });

    expect(decision).toEqual({
      action: "reject",
      message: ASSIGNMENT_MESSAGES.alreadySubmitting,
    });
  });

  it("checks the pending guard before the field guards", () => {
    // A pending request must never be overridden by a validation message,
    // otherwise a fast double-submit could slip through.
    const decision = decideAssignmentSubmission({
      employeeId: "",
      templateId: "",
      isPending: true,
    });

    expect(decision).toEqual({
      action: "reject",
      message: ASSIGNMENT_MESSAGES.alreadySubmitting,
    });
  });

  it("rejects a missing employee", () => {
    const decision = decideAssignmentSubmission({
      employeeId: "",
      templateId: TEMPLATE_ID,
      isPending: false,
    });

    expect(decision).toEqual({ action: "reject", message: ASSIGNMENT_MESSAGES.missingEmployee });
  });

  it("rejects a missing template", () => {
    const decision = decideAssignmentSubmission({
      employeeId: EMPLOYEE_ID,
      templateId: "",
      isPending: false,
    });

    expect(decision).toEqual({ action: "reject", message: ASSIGNMENT_MESSAGES.missingTemplate });
  });
});

describe("resolveAssignmentOutcome", () => {
  it("closes the dialog and refreshes the list on confirmed success", () => {
    const result: CreateAssignmentResult = {
      ok: true,
      assignmentId: "990e8400-e29b-41d4-a716-446655440000",
    };

    expect(resolveAssignmentOutcome(result)).toEqual({
      closeDialog: true,
      refreshList: true,
      message: "",
    });
  });

  const failures: Array<[Extract<CreateAssignmentResult, { ok: false }>["error"], string]> = [
    ["denied", ASSIGNMENT_MESSAGES.denied],
    ["invalid", ASSIGNMENT_MESSAGES.invalid],
    ["duplicate", ASSIGNMENT_MESSAGES.duplicate],
    ["creation_failed", ASSIGNMENT_MESSAGES.creationFailed],
  ];

  for (const [error, message] of failures) {
    it(`stays open with the safe ${error} message`, () => {
      expect(resolveAssignmentOutcome({ ok: false, error })).toEqual({
        closeDialog: false,
        refreshList: false,
        message,
      });
    });
  }

  it("never leaks database detail for a creation failure", () => {
    const outcome = resolveAssignmentOutcome({ ok: false, error: "creation_failed" });

    expect(outcome.message).toBe(ASSIGNMENT_MESSAGES.creationFailed);
    expect(outcome.message).not.toMatch(/23505|constraint|relation|sql|postgres/i);
  });

  it("maps an unknown error code to the generic safe message", () => {
    expect(resolveAssignmentOutcome({ ok: false, error: "kaboom" })).toEqual({
      closeDialog: false,
      refreshList: false,
      message: ASSIGNMENT_MESSAGES.unknown,
    });
  });

  it("maps a success payload with no assignment id to the generic safe message", () => {
    // Never close on an unconfirmed success.
    expect(resolveAssignmentOutcome({ ok: true })).toEqual({
      closeDialog: false,
      refreshList: false,
      message: ASSIGNMENT_MESSAGES.unknown,
    });
    expect(resolveAssignmentOutcome({ ok: true, assignmentId: "" })).toEqual({
      closeDialog: false,
      refreshList: false,
      message: ASSIGNMENT_MESSAGES.unknown,
    });
  });

  for (const value of [undefined, null, "ok", 42, true] as unknown[]) {
    it(`maps the non-object result ${JSON.stringify(value) ?? "undefined"} to the generic safe message`, () => {
      expect(resolveAssignmentOutcome(value)).toEqual({
        closeDialog: false,
        refreshList: false,
        message: ASSIGNMENT_MESSAGES.unknown,
      });
    });
  }

  it("never closes the dialog for any failure shape", () => {
    const shapes: unknown[] = [
      { ok: false, error: "denied" },
      { ok: false, error: "invalid" },
      { ok: false, error: "duplicate" },
      { ok: false, error: "creation_failed" },
      { ok: false },
      {},
      new Error("network down"),
    ];

    for (const shape of shapes) {
      const outcome = resolveAssignmentOutcome(shape);
      expect(outcome.closeDialog).toBe(false);
      expect(outcome.refreshList).toBe(false);
      expect(outcome.message.length).toBeGreaterThan(0);
    }
  });
});
