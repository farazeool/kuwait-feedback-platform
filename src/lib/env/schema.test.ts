import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./schema";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
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
    expect(parseServerEnv(validPublicEnv).APP_TIME_ZONE).toBe("Asia/Kuwait");
  });
});
