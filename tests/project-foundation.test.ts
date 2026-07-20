import { describe, expect, it } from "vitest";

import {
  APP_TIME_ZONE,
  PLATFORM_ROLES,
  SUPPORTED_LOCALES,
} from "@/lib/config/platform";
import type { PlatformRole, SupportedLocale } from "@/types/platform";
import { surveyDraftSchema } from "@/validation";

describe("project foundation", () => {
  it("defines the supported locales and Kuwait timezone", () => {
    const locales: readonly SupportedLocale[] = SUPPORTED_LOCALES;

    expect(locales).toEqual(["en", "ar"]);
    expect(APP_TIME_ZONE).toBe("Asia/Kuwait");
  });

  it("defines all durable authorization roles", () => {
    const roles: readonly PlatformRole[] = PLATFORM_ROLES;

    expect(roles).toEqual([
      "platform_admin",
      "organization_owner",
      "organization_admin",
      "location_manager",
      "analyst",
    ]);
  });

  it("exposes feature validation through the validation boundary", () => {
    expect(surveyDraftSchema.safeParse({}).success).toBe(false);
  });
});
