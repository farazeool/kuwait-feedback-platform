import { describe, expect, it } from "vitest";

import { surveyDraftSchema, surveyPublicationSchema, toDatabaseQuestions } from "./schemas";

const validDraft = {
  surveyId: null,
  titleEn: "Customer satisfaction",
  titleAr: "رضا العملاء",
  descriptionEn: "Tell us about your visit",
  descriptionAr: "أخبرنا عن زيارتك",
  thankYouEn: "Thank you",
  thankYouAr: "شكراً",
  defaultLocale: "en",
  locationIds: ["30000000-0000-4000-8000-000000000001"],
  questions: [{ id: "q1", type: "rating", labelEn: "Rate us", labelAr: "قيّمنا", helpTextEn: "", helpTextAr: "", required: true, ratingMin: 1, ratingMax: 5 }],
};

describe("survey builder validation", () => {
  it("accepts a valid publishable bilingual survey", () => {
    expect(surveyPublicationSchema.safeParse(validDraft).success).toBe(true);
  });

  it("allows an empty but otherwise valid draft", () => {
    expect(surveyDraftSchema.safeParse({ ...validDraft, questions: [] }).success).toBe(true);
  });

  it("rejects invalid rating bounds and incomplete choice options", () => {
    expect(surveyDraftSchema.safeParse({ ...validDraft, questions: [{ ...validDraft.questions[0], ratingMin: 5, ratingMax: 5 }] }).success).toBe(false);
    expect(surveyDraftSchema.safeParse({ ...validDraft, questions: [{ id: "q2", type: "multiple_choice", labelEn: "Choose", labelAr: "", helpTextEn: "", helpTextAr: "", required: false, options: [{ id: "o1", labelEn: "One", labelAr: "" }] }] }).success).toBe(false);
  });

  it("maps builder questions to the trusted RPC payload", () => {
    expect(toDatabaseQuestions(surveyPublicationSchema.parse(validDraft).questions)[0]).toMatchObject({ type: "rating", rating_min: 1, rating_max: 5 });
  });
});
