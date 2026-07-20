import { z } from "zod";

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  locale: z.enum(["en", "ar"]),
});

export const accountPasswordSchema = z.object({
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords must match",
});
