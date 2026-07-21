import { z } from "zod";

const optionalLocalizedText = z.string().trim().max(500).default("");

const optionSchema = z.object({
  id: z.string().min(1).max(100),
  labelEn: z.string().trim().min(1).max(300),
  labelAr: z.string().trim().max(300).default(""),
  concernCategoryId: z.string().uuid().nullable().optional(),
});

const questionBase = z.object({
  id: z.string().min(1).max(100),
  labelEn: z.string().trim().min(1).max(500),
  labelAr: optionalLocalizedText,
  helpTextEn: optionalLocalizedText,
  helpTextAr: optionalLocalizedText,
  required: z.boolean().default(false),
});

const ratingQuestionSchema = questionBase
  .extend({
    type: z.literal("rating"),
    ratingMin: z.number().int().min(0).max(9),
    ratingMax: z.number().int().min(1).max(10),
    ratingScale: z.string().regex(/^[a-z0-9_]+$/).nullable().optional(),
  })
  .refine((question) => question.ratingMax > question.ratingMin, {
    message: "Rating maximum must be greater than the minimum",
    path: ["ratingMax"],
  });

const multipleChoiceQuestionSchema = questionBase.extend({
  type: z.literal("multiple_choice"),
  options: z.array(optionSchema).min(2).max(20),
  allowMultiple: z.boolean().default(false),
});

const textQuestionSchema = questionBase.extend({
  type: z.literal("text"),
  textMaxLength: z.number().int().min(1).max(4000),
});

export const surveyBuilderQuestionSchema = z.discriminatedUnion("type", [
  ratingQuestionSchema,
  multipleChoiceQuestionSchema,
  textQuestionSchema,
]);

export const surveyDraftSchema = z.object({
  surveyId: z.string().uuid().nullable().default(null),
  surveyType: z.enum(["generic", "fresh_produce"]).default("generic"),
  titleEn: z.string().trim().min(1).max(200),
  titleAr: z.string().trim().max(200).default(""),
  descriptionEn: z.string().trim().max(1000).default(""),
  descriptionAr: z.string().trim().max(1000).default(""),
  thankYouEn: z.string().trim().max(500).default(""),
  thankYouAr: z.string().trim().max(500).default(""),
  defaultLocale: z.enum(["en", "ar"]).default("en"),
  locationIds: z.array(z.string().uuid()).min(1).max(20),
  questions: z.array(surveyBuilderQuestionSchema).max(50),
});

export const surveyPublicationSchema = surveyDraftSchema.extend({
  questions: z.array(surveyBuilderQuestionSchema).min(1).max(50),
});

export type SurveyDraft = z.infer<typeof surveyDraftSchema>;
export type SurveyBuilderQuestion = z.infer<typeof surveyBuilderQuestionSchema>;

export function toDatabaseQuestions(questions: SurveyBuilderQuestion[]) {
  return questions.map((question) => ({
    type: question.type,
    label_en: question.labelEn,
    label_ar: question.labelAr,
    help_text_en: question.helpTextEn,
    help_text_ar: question.helpTextAr,
    required: question.required,
    rating_min: question.type === "rating" ? question.ratingMin : null,
    rating_max: question.type === "rating" ? question.ratingMax : null,
    rating_scale: question.type === "rating" ? (question.ratingScale ?? null) : null,
    allow_multiple: question.type === "multiple_choice" ? question.allowMultiple : false,
    text_max_length: question.type === "text" ? question.textMaxLength : null,
    options:
      question.type === "multiple_choice"
        ? question.options.map((option) => ({
            label_en: option.labelEn,
            label_ar: option.labelAr,
            concern_category_id: option.concernCategoryId ?? null,
          }))
        : [],
  }));
}
