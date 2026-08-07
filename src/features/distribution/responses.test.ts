import { describe, expect, it } from "vitest";

import {
  RESPONSES_LIST_MESSAGES,
  RESPONSE_PAGE_LIMITS,
  decideListResponses,
  normalizeResponseEnvelope,
  resolveResponseListError,
} from "./responses";

const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("decideListResponses", () => {
  it("accepts a valid UUID and applies default limit / offset", () => {
    const decision = decideListResponses({ assignmentId: ASSIGNMENT_ID });
    expect(decision).toEqual({
      action: "fetch",
      assignmentId: ASSIGNMENT_ID,
      start: null,
      end: null,
      limit: RESPONSE_PAGE_LIMITS.default,
      offset: 0,
    });
  });

  it("rejects an empty assignmentId with the missing-employee message", () => {
    expect(decideListResponses({ assignmentId: "" })).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.missingAssignment,
    });
  });

  it("rejects a non-UUID assignmentId", () => {
    expect(decideListResponses({ assignmentId: "not-a-uuid" })).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.badAssignmentId,
    });
  });

  it("normalizes string limit and offset from query params", () => {
    const decision = decideListResponses({
      assignmentId: ASSIGNMENT_ID,
      limit: "50",
      offset: "20",
    });
    expect(decision.action).toBe("fetch");
    if (decision.action !== "fetch") throw new Error("expected fetch");
    expect(decision.limit).toBe(50);
    expect(decision.offset).toBe(20);
  });

  it("clamps a limit that is above the minimum but below max to the supplied value", () => {
    const decision = decideListResponses({
      assignmentId: ASSIGNMENT_ID,
      limit: 42,
    });
    if (decision.action !== "fetch") throw new Error("expected fetch");
    expect(decision.limit).toBe(42);
  });

  it("rejects a limit below the minimum with a typed message", () => {
    expect(decideListResponses({ assignmentId: ASSIGNMENT_ID, limit: 0 })).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.limitTooSmall,
    });
  });

  it("rejects a limit above the maximum with a typed message", () => {
    expect(
      decideListResponses({ assignmentId: ASSIGNMENT_ID, limit: 9999 }),
    ).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.limitTooLarge,
    });
  });

  it("parses ISO dates and rejects malformed ones", () => {
    const decision = decideListResponses({
      assignmentId: ASSIGNMENT_ID,
      start: "2026-01-01T00:00:00Z",
      end: "2026-12-31T23:59:59Z",
    });
    expect(decision.action).toBe("fetch");
    if (decision.action !== "fetch") throw new Error("expected fetch");
    expect(decision.start).toBe("2026-01-01T00:00:00.000Z");
    expect(decision.end).toBe("2026-12-31T23:59:59.000Z");
  });

  it("rejects a malformed date with the badDate message", () => {
    expect(
      decideListResponses({ assignmentId: ASSIGNMENT_ID, start: "not-a-date" }),
    ).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.badDate,
    });
  });

  it("rejects when the range is inverted (start after end)", () => {
    expect(
      decideListResponses({
        assignmentId: ASSIGNMENT_ID,
        start: "2026-06-01T00:00:00Z",
        end: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      action: "reject",
      message: RESPONSES_LIST_MESSAGES.invalidRange,
    });
  });

  it("clamps a negative offset back to 0 instead of erroring", () => {
    const decision = decideListResponses({
      assignmentId: ASSIGNMENT_ID,
      offset: -5,
    });
    if (decision.action !== "fetch") throw new Error("expected fetch");
    expect(decision.offset).toBe(0);
  });
});

describe("normalizeResponseEnvelope", () => {
  it("returns the safe empty envelope when given garbage", () => {
    const env = normalizeResponseEnvelope(null);
    expect(env.events).toEqual([]);
    expect(env.total).toBe(0);
    expect(env.assignment.id).toBe("");
  });

  it("returns the safe empty envelope when given a primitive", () => {
    expect(normalizeResponseEnvelope("hello").events).toEqual([]);
    expect(normalizeResponseEnvelope(42).total).toBe(0);
  });

  it("clamps limit and offset to the documented ranges", () => {
    const env = normalizeResponseEnvelope({
      events: [],
      total: 0,
      channel: "email",
      template: "Default",
      assignment: {
        id: "x",
        organization_id: "y",
        channel: "email",
        employee_name: null,
        employee_id: null,
        location_name_en: null,
        location_name_ar: null,
      },
      limit: 9999,
      offset: -10,
    });
    expect(env.limit).toBe(RESPONSE_PAGE_LIMITS.max);
    expect(env.offset).toBe(0);
  });

  it("preserves the supplied events when they are well-formed", () => {
    const env = normalizeResponseEnvelope({
      events: [
        {
          id: "1",
          assignment_id: ASSIGNMENT_ID,
          organization_id: "org",
          rating: 5,
          label: "Very satisfied",
          emoji: "😀",
          created_at: "2026-01-01T00:00:00Z",
          user_agent: "ua",
          followup: null,
        },
      ],
      total: 1,
      channel: "email",
      template: "Default",
      assignment: {
        id: ASSIGNMENT_ID,
        organization_id: "org",
        channel: "email",
        employee_name: "Alice",
        employee_id: "emp-1",
        location_name_en: null,
        location_name_ar: null,
      },
      limit: 25,
      offset: 0,
    });
    expect(env.events).toHaveLength(1);
    expect(env.events[0]?.rating).toBe(5);
    expect(env.assignment.employee_name).toBe("Alice");
  });

  it("infers total from events when total is missing", () => {
    const env = normalizeResponseEnvelope({ events: [{}, {}, {}] });
    expect(env.total).toBe(3);
  });
});

describe("resolveResponseListError", () => {
  it("maps the documented reasons to user-safe messages", () => {
    expect(resolveResponseListError("denied")).toContain("permission");
    expect(resolveResponseListError("not_found")).toContain("could not be found");
    expect(resolveResponseListError("forbidden")).toContain("does not belong");
  });

  it("falls back to the generic safe message for unknown reasons", () => {
    expect(resolveResponseListError("weird-thing")).toContain("could not load");
    expect(resolveResponseListError(null)).toContain("could not load");
    expect(resolveResponseListError(undefined)).toContain("could not load");
  });
});