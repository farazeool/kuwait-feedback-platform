import { z } from "zod";

export const quickFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  categories: z.array(z.string()).max(6).optional(),
  comment: z.string().max(1000).optional(),
});

export type QuickFeedback = z.infer<typeof quickFeedbackSchema>;
