import { z } from "zod";

const pointSchema = z.object({
  value: z.coerce.number().int(),
  labelEn: z.string().trim().max(120),
  labelAr: z.string().trim().max(120),
});

export const ratingScaleFormSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120),
  scaleMin: z.coerce.number().int(),
  scaleMax: z.coerce.number().int(),
  satisfiedMin: z.coerce.number().int(),
  negativeMax: z.coerce.number().int(),
  isActive: z.enum(["true", "false"]).optional().default("true"),
  points: z.array(pointSchema).min(1),
});
