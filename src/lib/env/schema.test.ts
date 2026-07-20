import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./schema";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

const validServerEnv = {
  ...validPublicEnv,
  SUBMISSION_FINGERPRINT_SECRET: "test-fingerprint-secret-at-least-32-characters",
};

describe("environment validation", () => {
  it("accepts browser-safe configuration", () => {
    expect(parsePublicEnv(validPublicEnv)).toEqual(validPublicEnv);
  });

  it("rejects invalid public URLs", () => {
    expect(() =>
      parsePublicEnv({ ...validPublicEnv, NEXT_PUBLIC_APP_URL: "not-a-url" }),
    ).toThrow();
  });

  it("defaults server-side reporting to Kuwait time", () => {
    expect(parseServerEnv(validServerEnv).APP_TIME_ZONE).toBe("Asia/Kuwait");
  });

  it("rejects localhost URLs in production", () => {
    expect(() => parseServerEnv({ ...validServerEnv, APP_ENV: "production", SUPABASE_PROJECT_ENVIRONMENT: "production" })).toThrow(/non-local HTTPS/);
  });

  it("requires preview credentials to be marked as preview", () => {
    expect(() => parseServerEnv({
      ...validServerEnv,
      APP_ENV: "preview",
      SUPABASE_PROJECT_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://preview.example.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://preview.supabase.co",
    })).toThrow(/must match/);
  });

  it("denies bot-protection bypass outside local development", () => {
    expect(() => parseServerEnv({
      ...validServerEnv,
      APP_ENV: "production",
      SUPABASE_PROJECT_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
      NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co",
      BOT_PROTECTION_PROVIDER: "external",
      BOT_PROTECTION_BYPASS: "true",
    })).toThrow(/bypass/);
  });
});
