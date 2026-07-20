import { z } from "zod";

export const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(500),
  ar: z.string().trim().min(1).max(500),
});

const questionBaseSchema = z.object({
  id: z.string().uuid(),
  label: localizedTextSchema,
  required: z.boolean().default(false),
});

const ratingQuestionSchema = questionBaseSchema
  .extend({
    type: z.literal("rating"),
    minimum: z.number().int().min(0).max(9),
    maximum: z.number().int().min(1).max(10),
  })
  .refine(({ minimum, maximum }) => maximum > minimum, {
    message: "Rating maximum must be greater than minimum",
    path: ["maximum"],
  });

const choiceOptionSchema = z.object({
  id: z.string().uuid(),
  label: localizedTextSchema,
});

const multipleChoiceQuestionSchema = questionBaseSchema.extend({
  type: z.literal("multiple_choice"),
  allowMultiple: z.boolean().default(false),
  options: z.array(choiceOptionSchema).min(2).max(20),
});

const textQuestionSchema = questionBaseSchema.extend({
  type: z.literal("text"),
  maximumLength: z.number().int().min(1).max(4000).default(1000),
});

export const surveyQuestionSchema = z.discriminatedUnion("type", [
  ratingQuestionSchema,
  multipleChoiceQuestionSchema,
  textQuestionSchema,
]);

export const surveyDefinitionSchema = z.object({
  title: localizedTextSchema,
  questions: z.array(surveyQuestionSchema).min(1).max(50),
});

export type SurveyDefinition = z.infer<typeof surveyDefinitionSchema>;
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;
