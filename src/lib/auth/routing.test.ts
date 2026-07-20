import { describe, expect, it } from "vitest";

import { resolveProtectedDestination } from "./routing";

describe("protected route decisions", () => {
  it("denies an unauthenticated request", () => {
    expect(
      resolveProtectedDestination({
        authenticated: false,
        hasPlatformAccess: false,
        membershipCount: 0,
      }),
    ).toBe("/login");
  });

  it("routes a user without membership to onboarding", () => {
    expect(
      resolveProtectedDestination({
        authenticated: true,
        hasPlatformAccess: false,
        membershipCount: 0,
      }),
    ).toBe("/onboarding");
  });

  it("allows tenant members and platform administrators", () => {
    expect(
      resolveProtectedDestination({
        authenticated: true,
        hasPlatformAccess: false,
        membershipCount: 1,
      }),
    ).toBe("allow");
    expect(
      resolveProtectedDestination({
        authenticated: true,
        hasPlatformAccess: true,
        membershipCount: 0,
      }),
    ).toBe("allow");
  });
});
