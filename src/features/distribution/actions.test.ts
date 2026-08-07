import { describe, expect, it } from "vitest";
import { distributionAssignmentSchema } from "./schema";

describe("distributionAssignmentSchema", () => {
  describe("employee assignment (fk kind)", () => {
    it("validates a valid employee assignment", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
        surveyId: null,
        metadata: {},
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.kind === "fk") {
        expect(result.data.kind).toBe("fk");
        expect(result.data.targetType).toBe("employee");
        expect(result.data.targetId).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });

    it("requires valid UUID for targetId", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "not-a-uuid",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("requires valid UUID for templateId", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "invalid",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts employee, location, or touchpoint as targetType", () => {
      const targets: Array<"employee" | "location" | "touchpoint"> = [
        "employee",
        "location",
        "touchpoint",
      ];

      for (const targetType of targets) {
        const input = {
          kind: "fk" as const,
          targetType,
          targetId: "550e8400-e29b-41d4-a716-446655440000",
          templateId: "660e8400-e29b-41d4-a716-446655440000",
        };

        const result = distributionAssignmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid targetType", () => {
      const input = {
        kind: "fk" as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetType: "invalid" as any,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts optional surveyId as UUID or null", () => {
      const validCases = [
        { surveyId: "770e8400-e29b-41d4-a716-446655440000" },
        { surveyId: null },
        {}, // surveyId omitted
      ];

      for (const extraFields of validCases) {
        const input = {
          kind: "fk" as const,
          targetType: "employee" as const,
          targetId: "550e8400-e29b-41d4-a716-446655440000",
          templateId: "660e8400-e29b-41d4-a716-446655440000",
          ...extraFields,
        };

        const result = distributionAssignmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it("accepts optional campaignId as UUID or null", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
        campaignId: "880e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts optional metadata object", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
        metadata: { notes: "test assignment", priority: "high" },
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({ notes: "test assignment", priority: "high" });
      }
    });

    it("accepts optional expiresAt as ISO datetime or null", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
        expiresAt: "2026-12-31T23:59:59Z",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("defaults metadata to empty object when omitted", () => {
      const input = {
        kind: "fk" as const,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({});
      }
    });
  });

  describe("generic assignment", () => {
    it("validates a valid generic assignment", () => {
      const input = {
        kind: "generic" as const,
        subjectType: "department",
        subjectId: "sales-team-01",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success && result.data.kind === "generic") {
        expect(result.data.kind).toBe("generic");
        expect(result.data.subjectType).toBe("department");
        expect(result.data.subjectId).toBe("sales-team-01");
      }
    });

    it("requires non-empty subjectType", () => {
      const input = {
        kind: "generic" as const,
        subjectType: "",
        subjectId: "test-id",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("requires non-empty subjectId", () => {
      const input = {
        kind: "generic" as const,
        subjectType: "department",
        subjectId: "",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("enforces max length on subjectType (64 chars)", () => {
      const tooLong = "a".repeat(65);
      const input = {
        kind: "generic" as const,
        subjectType: tooLong,
        subjectId: "test-id",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("enforces max length on subjectId (200 chars)", () => {
      const tooLong = "a".repeat(201);
      const input = {
        kind: "generic" as const,
        subjectType: "department",
        subjectId: tooLong,
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts subjectType and subjectId at maximum allowed length", () => {
      const input = {
        kind: "generic" as const,
        subjectType: "a".repeat(64),
        subjectId: "b".repeat(200),
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("discriminated union", () => {
    it("rejects assignment when kind is missing", () => {
      const input = {
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects assignment with invalid kind", () => {
      const input = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: "invalid" as any,
        targetType: "employee" as const,
        targetId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440000",
      };

      const result = distributionAssignmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
