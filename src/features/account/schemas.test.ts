import { describe, expect, it } from "vitest";
import { accountPasswordSchema, profileSettingsSchema } from "./schemas";

describe("account settings", () => {
  it("validates profile locale and display name", () => expect(profileSettingsSchema.safeParse({ displayName: "Demo User", locale: "ar" }).success).toBe(true));
  it("requires matching strong passwords", () => expect(accountPasswordSchema.safeParse({ password: "long-password", confirmPassword: "different-value" }).success).toBe(false));
});
