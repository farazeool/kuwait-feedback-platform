import { z } from "zod";

export const appEnvironmentSchema = z.enum(["local", "preview", "production"]);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const serverEnvSchema = publicEnvSchema.extend({
  APP_ENV: appEnvironmentSchema.default("local"),
  SUPABASE_PROJECT_ENVIRONMENT: appEnvironmentSchema.optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUBMISSION_FINGERPRINT_SECRET: z.string().min(32),
  APP_TIME_ZONE: z.literal("Asia/Kuwait").default("Asia/Kuwait"),
  EMAIL_DELIVERY_MODE: z.enum(["preview", "smtp"]).default("preview"),
  SMTP_HOST: z.string().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(54325),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@example.test"),
  BOT_PROTECTION_PROVIDER: z.enum(["disabled", "external"]).default("disabled"),
  BOT_PROTECTION_BYPASS: z.enum(["true", "false"]).default("false"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parsePublicEnv(input: unknown): PublicEnv {
  return publicEnvSchema.parse(input);
}

export function parseServerEnv(input: unknown): ServerEnv {
  const env = serverEnvSchema.parse(input);
  const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
  const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  const isLocalHost = (url: URL) => ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (env.APP_ENV === "local") {
    if (!isLocalHost(appUrl) || !isLocalHost(supabaseUrl)) {
      throw new Error("Local environment may use only local application and Supabase URLs.");
    }
  } else {
    if (isLocalHost(appUrl) || isLocalHost(supabaseUrl) || appUrl.protocol !== "https:" || supabaseUrl.protocol !== "https:") {
      throw new Error("Preview and production require non-local HTTPS application and Supabase URLs.");
    }
    if (env.SUPABASE_PROJECT_ENVIRONMENT !== env.APP_ENV) {
      throw new Error("Supabase project environment must match the application environment.");
    }
  }

  if (env.BOT_PROTECTION_BYPASS === "true" && env.APP_ENV !== "local") {
    throw new Error("Bot-protection bypass is allowed only for local development.");
  }
  if (env.APP_ENV === "production" && env.BOT_PROTECTION_PROVIDER === "disabled") {
    throw new Error("Production requires an enabled bot-protection provider.");
  }

  return env;
}
