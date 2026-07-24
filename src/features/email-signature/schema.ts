import { z } from "zod";

export const emailSignatureConfigSchema = z.object({
  organizationId: z.string().uuid(),
  surveyId: z.string().uuid(),
  ratingStyle: z.enum(["emoji", "star"]).default("emoji"),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type EmailSignatureConfig = z.infer<typeof emailSignatureConfigSchema>;
