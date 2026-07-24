import { z } from "zod";

const localizedSchema = z.object({
  en: z.string().nullable(),
  ar: z.string().nullable(),
});

const publicOptionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: localizedSchema,
  concern_category_id: z.string().uuid().nullable().optional(),
});

const ratingScalePointSchema = z.object({
  value: z.number().int(),
  position: z.number().int(),
  label: localizedSchema,
});

const ratingScaleSchema = z.object({
  name: localizedSchema,
  scale_min: z.number().int(),
  scale_max: z.number().int(),
  satisfied_min: z.number().int(),
  negative_max: z.number().int(),
  points: z.array(ratingScalePointSchema),
});

const publicQuestionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["rating", "multiple_choice", "text"]),
  position: z.number().int(),
  prompt: localizedSchema,
  help_text: localizedSchema,
  required: z.boolean(),
  rating_min: z.number().int().nullable(),
  rating_max: z.number().int().nullable(),
  rating_scale: z.string().nullable().optional(),
  allow_multiple: z.boolean(),
  text_max_length: z.number().int().nullable(),
  options: z.array(publicOptionSchema),
});

export const publicSurveySchema = z.object({
  public_slug: z.string(),
  survey_type: z.enum(["generic", "fresh_produce"]).optional().default("generic"),
  title: localizedSchema,
  description: localizedSchema,
  thank_you: localizedSchema,
  default_locale: z.enum(["en", "ar"]),
  organization: z.object({
    name: localizedSchema,
    branding: z.object({
      primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      logo_path: z.string().nullable(),
      logo_url: z.string().url().nullable().optional(),
      header_style: z.string(),
      footer: localizedSchema,
    }),
  }),
  location: z.object({ name: localizedSchema }),
  rating_scales: z.record(z.string(), ratingScaleSchema).optional().default({}),
  questions: z.array(publicQuestionSchema).min(1).max(50),
});

const answerSchema = z.object({
  questionId: z.string().uuid(),
  rating: z.number().int().optional(),
  text: z.string().optional(),
  optionIds: z.array(z.string().uuid()).max(20).optional(),
}).strict();

export const submissionPayloadSchema = z.object({
  locale: z.enum(["en", "ar"]),
  answers: z.array(answerSchema).max(50),
  idempotencyKey: z.string().uuid(),
  startedAt: z.number().int().positive(),
  website: z.string().max(0),
  botToken: z.string().min(1).max(4_096).optional(),
  channel: z.enum(["qr", "kiosk", "web", "email", "walk_in", "website", "phone", "whatsapp", "tablet", "sms"]).optional(),
  touchpointToken: z.string().min(24).max(128).optional(),
  // CX Channels expansion fields
  feedbackMode: z.enum(["standard", "quick"]).optional().default("standard"),
  campaignId: z.string().uuid().optional(),
  sourceIdentifier: z.string().max(100).optional(),
  employeeReference: z.string().max(100).optional(),
  interactionReference: z.string().max(100).optional(),
  // Quick feedback specific — sent instead of answers when feedbackMode is "quick"
  quickRating: z.number().int().min(1).max(5).optional(),
  quickCategories: z.array(z.string()).max(6).optional(),
  quickComment: z.string().max(1000).optional(),
}).strict();

export type PublicSurvey = z.infer<typeof publicSurveySchema>;
export type RatingScale = z.infer<typeof ratingScaleSchema>;
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;

export function validateAnswersForSurvey(
  survey: PublicSurvey,
  payload: SubmissionPayload,
) {
  const byQuestion = new Map(payload.answers.map((answer) => [answer.questionId, answer]));
  if (byQuestion.size !== payload.answers.length) return false;

  for (const question of survey.questions) {
    const answer = byQuestion.get(question.id);
    if (!answer) {
      if (question.required) return false;
      continue;
    }

    if (question.type === "rating") {
      if (
        answer.rating === undefined ||
        answer.text !== undefined ||
        answer.optionIds !== undefined ||
        question.rating_min === null ||
        question.rating_max === null ||
        answer.rating < question.rating_min ||
        answer.rating > question.rating_max
      ) return false;

      if (question.rating_scale) {
        const scale = survey.rating_scales[question.rating_scale];
        if (!scale || !scale.points.some((p) => p.value === answer.rating)) return false;
      }
    } else if (question.type === "text") {
      const text = answer.text?.trim() ?? "";
      if (answer.rating !== undefined || answer.optionIds !== undefined || !text || question.text_max_length === null || text.length > question.text_max_length) {
        return false;
      }
    } else {
      const optionIds = answer.optionIds ?? [];
      const allowed = new Set(question.options.map((option) => option.id));
      if (answer.rating !== undefined || answer.text !== undefined || optionIds.length === 0) return false;
      if (!question.allow_multiple && optionIds.length !== 1) return false;
      if (!optionIds.every((id) => allowed.has(id))) return false;
    }
  }

  return payload.answers.every((answer) =>
    survey.questions.some((question) => question.id === answer.questionId),
  );
}

export function toDatabaseAnswers(payload: SubmissionPayload) {
  return payload.answers.map((answer) => ({
    question_id: answer.questionId,
    ...(answer.rating !== undefined ? { rating: answer.rating } : {}),
    ...(answer.text !== undefined ? { text: answer.text.trim() } : {}),
    ...(answer.optionIds !== undefined ? { option_ids: answer.optionIds } : {}),
  }));
}
