import { describe, expect, it } from "vitest";

import {
  publicSurveySchema,
  submissionPayloadSchema,
  validateAnswersForSurvey,
} from "./schema";

const ratingId = "50000000-0000-4000-8000-000000000001";
const choiceId = "50000000-0000-4000-8000-000000000002";
const optionId = "60000000-0000-4000-8000-000000000001";

const survey = publicSurveySchema.parse({
  public_slug: "safe-public-survey-identifier",
  title: { en: "Customer feedback", ar: "ملاحظات العملاء" },
  description: { en: null, ar: null },
  thank_you: { en: "Thank you", ar: "شكراً" },
  default_locale: "en",
  organization: { name: { en: "Demo Co", ar: "شركة تجريبية" }, branding: { primary_color: "#006c5b", accent_color: "#d5a742", logo_path: null, header_style: "solid", footer: { en: null, ar: null } } },
  location: { name: { en: "Salmiya", ar: "السالمية" } },
  questions: [
    { id: ratingId, type: "rating", position: 1, prompt: { en: "Rate us", ar: "قيّمنا" }, help_text: { en: null, ar: null }, required: true, rating_min: 1, rating_max: 5, allow_multiple: false, text_max_length: null, options: [] },
    { id: choiceId, type: "multiple_choice", position: 2, prompt: { en: "Choose", ar: "اختر" }, help_text: { en: null, ar: null }, required: true, rating_min: null, rating_max: null, allow_multiple: false, text_max_length: null, options: [{ id: optionId, position: 1, label: { en: "Good", ar: "جيد" } }] },
  ],
});

describe("public feedback validation", () => {
  it("accepts a complete survey-specific answer set", () => {
    const payload = submissionPayloadSchema.parse({ locale: "ar", idempotencyKey: "70000000-0000-4000-8000-000000000001", startedAt: 1, website: "", feedbackMode: "standard", answers: [{ questionId: ratingId, rating: 5 }, { questionId: choiceId, optionIds: [optionId] }] });
    expect(validateAnswersForSurvey(survey, payload)).toBe(true);
  });

  it("rejects invalid ratings, choices, missing answers, and honeypots", () => {
    const base = { locale: "en" as const, idempotencyKey: "70000000-0000-4000-8000-000000000001", startedAt: 1, website: "" };
    expect(validateAnswersForSurvey(survey, { ...base, feedbackMode: "standard", answers: [{ questionId: ratingId, rating: 9 }, { questionId: choiceId, optionIds: [optionId] }] })).toBe(false);
    expect(validateAnswersForSurvey(survey, { ...base, feedbackMode: "standard", answers: [{ questionId: ratingId, rating: 5 }, { questionId: choiceId, optionIds: [ratingId] }] })).toBe(false);
    expect(validateAnswersForSurvey(survey, { ...base, feedbackMode: "standard", answers: [{ questionId: ratingId, rating: 5 }] })).toBe(false);
    expect(submissionPayloadSchema.safeParse({ ...base, feedbackMode: "standard", website: "bot", answers: [] }).success).toBe(false);
  });
});
