import { describe, expect, it } from "vitest";

import { surveyDefinitionSchema } from "./schemas";

const questionId = "11111111-1111-4111-8111-111111111111";

describe("surveyDefinitionSchema", () => {
  it("accepts a bilingual rating survey", () => {
    const result = surveyDefinitionSchema.parse({
      title: { en: "Visit feedback", ar: "تقييم الزيارة" },
      questions: [
        {
          id: questionId,
          type: "rating",
          label: { en: "How was your visit?", ar: "كيف كانت زيارتك؟" },
          required: true,
          minimum: 1,
          maximum: 5,
        },
      ],
    });

    expect(result.questions).toHaveLength(1);
  });

  it("rejects a rating range with no usable interval", () => {
    const result = surveyDefinitionSchema.safeParse({
      title: { en: "Visit feedback", ar: "تقييم الزيارة" },
      questions: [
        {
          id: questionId,
          type: "rating",
          label: { en: "Rating", ar: "التقييم" },
          minimum: 5,
          maximum: 5,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
