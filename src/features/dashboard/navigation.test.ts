import { describe, expect, it } from "vitest";

import { navigationForRole } from "./navigation";

describe("role-aware dashboard navigation", () => {
  it("keeps team visibility read-only while hiding settings from scoped roles", () => {
    expect(navigationForRole("analyst").map((item) => item.label)).toContain("nav.team");
    expect(navigationForRole("location_manager").map((item) => item.label)).not.toContain("nav.settings");
  });

  it("shows tenant management to owners and organization admins", () => {
    expect(navigationForRole("organization_owner").map((item) => item.label)).toContain("nav.team");
    expect(navigationForRole("organization_admin").map((item) => item.label)).toContain("nav.settings");
  });
});
