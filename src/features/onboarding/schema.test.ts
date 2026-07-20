import { describe, expect, it } from "vitest";

import { onboardingSchema, slugifyLocation } from "./schema";

const valid = {
  organizationNameEn: "Kuwait Demo",
  organizationNameAr: "",
  organizationSlug: "kuwait-demo",
  businessCategory: "retail",
  phone: "+96522223333",
  locationNameEn: "Sharq Main",
  locationNameAr: "",
  governorate: "capital",
  area: "Sharq",
  address: "",
};

describe("onboarding validation", () => {
  it("accepts Kuwait organization and location data", () => {
    expect(onboardingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid slugs and non-Kuwait phone formats", () => {
    expect(onboardingSchema.safeParse({ ...valid, organizationSlug: "Bad Slug" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, phone: "+12025550123" }).success).toBe(false);
  });

  it("derives a safe location slug", () => {
    expect(slugifyLocation("Sharq Main Branch")).toBe("sharq-main-branch");
  });
});
