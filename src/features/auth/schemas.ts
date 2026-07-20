import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  next: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).optional().or(z.literal("")),
});

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
  next: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).optional().or(z.literal("")),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10).max(128),
    confirmPassword: z.string().min(10).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
