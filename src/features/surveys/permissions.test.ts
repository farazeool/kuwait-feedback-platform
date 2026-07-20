import { describe, expect, it } from "vitest";

import { canManageSurveyStructure, canViewSurvey } from "./permissions";

describe("role-aware survey controls", () => {
  it("limits structural management to administrators", () => {
    expect(canManageSurveyStructure("organization_owner")).toBe(true);
    expect(canManageSurveyStructure("organization_admin")).toBe(true);
    expect(canManageSurveyStructure("location_manager")).toBe(false);
    expect(canManageSurveyStructure("analyst")).toBe(false);
  });

  it("allows every tenant role to view RLS-permitted surveys", () => {
    expect(canViewSurvey("location_manager")).toBe(true);
    expect(canViewSurvey("analyst")).toBe(true);
  });
});
