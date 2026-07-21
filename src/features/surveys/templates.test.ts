import { describe, expect, it } from "vitest";

import { surveyPublicationSchema } from "@/features/surveys/schemas";
import {
  buildTemplateDraft,
  isSurveyTemplateId,
  SURVEY_TEMPLATE_SUMMARIES,
  type SurveyTemplateId,
} from "@/features/surveys/templates";

const ALL_IDS = SURVEY_TEMPLATE_SUMMARIES.map((template) => template.id);

describe("survey templates", () => {
  it("exposes the four required pilot templates", () => {
    expect(ALL_IDS).toEqual(["cafe_restaurant", "retail", "service_center", "general"]);
  });

  it("recognizes valid template ids and rejects others", () => {
    expect(isSurveyTemplateId("cafe_restaurant")).toBe(true);
    expect(isSurveyTemplateId("scratch")).toBe(false);
    expect(isSurveyTemplateId("../../etc/passwd")).toBe(false);
  });

  it.each(ALL_IDS)("builds a publishable, bilingual draft for %s", (id) => {
    const draft = buildTemplateDraft(id as SurveyTemplateId, ["11111111-1111-4111-8111-111111111111"]);
    // Publication schema requires at least one question and valid structure.
    const parsed = surveyPublicationSchema.safeParse(draft);
    expect(parsed.success).toBe(true);
    expect(draft.titleEn.length).toBeGreaterThan(0);
    expect(draft.titleAr.length).toBeGreaterThan(0);
    // Every question carries English and Arabic labels.
    for (const question of draft.questions) {
      expect(question.labelEn.trim().length).toBeGreaterThan(0);
      expect(question.labelAr.trim().length).toBeGreaterThan(0);
      if (question.type === "multiple_choice") {
        for (const option of question.options) {
          expect(option.labelEn.trim().length).toBeGreaterThan(0);
          expect(option.labelAr.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("assigns the caller's locations to the draft", () => {
    const locationIds = ["aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
    const draft = buildTemplateDraft("cafe_restaurant", locationIds);
    expect(draft.locationIds).toEqual(locationIds);
    // Defensive copy: mutating the input array must not affect the draft.
    locationIds.push("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(draft.locationIds).toHaveLength(2);
  });

  it("produces independent drafts with unique ids on every call (no shared mutable state)", () => {
    const first = buildTemplateDraft("cafe_restaurant", ["11111111-1111-4111-8111-111111111111"]);
    const second = buildTemplateDraft("cafe_restaurant", ["22222222-2222-4222-8222-222222222222"]);

    // Distinct question identifiers between independent copies.
    const firstIds = new Set(first.questions.map((question) => question.id));
    const secondIds = new Set(second.questions.map((question) => question.id));
    for (const id of secondIds) expect(firstIds.has(id)).toBe(false);

    // Question ids are unique within a single draft.
    expect(firstIds.size).toBe(first.questions.length);

    // Editing one copy must never leak into another (independent objects).
    first.questions[0].labelEn = "EDITED";
    expect(second.questions[0].labelEn).not.toBe("EDITED");
    first.titleEn = "EDITED TITLE";
    expect(second.titleEn).not.toBe("EDITED TITLE");
  });

  it("throws on an unknown template id", () => {
    expect(() => buildTemplateDraft("nope" as SurveyTemplateId, [])).toThrow();
  });

  it("returns a draft with no surveyId so it saves as a new, editable survey", () => {
    const draft = buildTemplateDraft("general", []);
    expect(draft.surveyId).toBeNull();
  });
});
