import { describe, expect, it } from "vitest";

import { navigationForRole } from "./navigation";

describe("role-aware dashboard navigation", () => {
  it("hides tenant management from analysts and location managers", () => {
    expect(navigationForRole("analyst").map((item) => item.label)).not.toContain("Team");
    expect(navigationForRole("location_manager").map((item) => item.label)).not.toContain("Settings");
  });

  it("shows tenant management to owners and organization admins", () => {
    expect(navigationForRole("organization_owner").map((item) => item.label)).toContain("Team");
    expect(navigationForRole("organization_admin").map((item) => item.label)).toContain("Settings");
  });
});
