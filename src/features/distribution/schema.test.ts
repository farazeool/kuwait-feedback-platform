import { describe, expect, it } from "vitest";

import { distributionAssignmentSchema, ratingSubmissionSchema } from "./schema";

const templateId = "10000000-0000-4000-8000-000000000001";
const targetId = "20000000-0000-4000-8000-000000000002";
const nonce = "0123456789abcdef0123456789abcdef0123"; // 36 hex chars
const token = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4"; // 28 chars, matches [a-zA-Z0-9-]{24,128}

describe("distributionAssignmentSchema", () => {
  it("accepts an fk-target assignment", () => {
    const parsed = distributionAssignmentSchema.parse({
      kind: "fk",
      templateId,
      targetType: "employee",
      targetId,
    });
    expect(parsed.kind).toBe("fk");
    if (parsed.kind === "fk") {
      expect(parsed.targetType).toBe("employee");
      expect(parsed.targetId).toBe(targetId);
    }
  });

  it("accepts a generic-subject assignment", () => {
    const parsed = distributionAssignmentSchema.parse({
      kind: "generic",
      templateId,
      subjectType: "branch",
      subjectId: "kuwait-city-01",
    });
    expect(parsed.kind).toBe("generic");
    if (parsed.kind === "generic") {
      expect(parsed.subjectType).toBe("branch");
      expect(parsed.subjectId).toBe("kuwait-city-01");
    }
  });

  it("rejects an unknown target type on the fk branch", () => {
    expect(
      distributionAssignmentSchema.safeParse({
        kind: "fk",
        templateId,
        targetType: "customer",
        targetId,
      }).success,
    ).toBe(false);
  });

  it("requires a discriminant to select a branch", () => {
    // Without `kind`, neither branch of the discriminated union applies.
    expect(
      distributionAssignmentSchema.safeParse({
        templateId,
        targetType: "employee",
        targetId,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty or oversized subjectId on the generic branch", () => {
    expect(
      distributionAssignmentSchema.safeParse({
        kind: "generic",
        templateId,
        subjectType: "branch",
        subjectId: "",
      }).success,
    ).toBe(false);
    expect(
      distributionAssignmentSchema.safeParse({
        kind: "generic",
        templateId,
        subjectType: "branch",
        subjectId: "x".repeat(201),
      }).success,
    ).toBe(false);
  });
});

describe("ratingSubmissionSchema", () => {
  it("accepts a valid submission", () => {
    const parsed = ratingSubmissionSchema.parse({ token, rating: 4, nonce });
    expect(parsed.rating).toBe(4);
  });

  it("rejects ratings outside 1–5 and non-integers", () => {
    expect(ratingSubmissionSchema.safeParse({ token, rating: 0, nonce }).success).toBe(false);
    expect(ratingSubmissionSchema.safeParse({ token, rating: 6, nonce }).success).toBe(false);
    expect(ratingSubmissionSchema.safeParse({ token, rating: 3.5, nonce }).success).toBe(false);
  });

  it("rejects malformed nonces and tokens", () => {
    expect(ratingSubmissionSchema.safeParse({ token, rating: 3, nonce: "xyz" }).success).toBe(false);
    expect(ratingSubmissionSchema.safeParse({ token: "short", rating: 3, nonce }).success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(
      ratingSubmissionSchema.safeParse({ token, rating: 3, nonce, website: "bot" }).success,
    ).toBe(false);
  });
});
