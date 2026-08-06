import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { getAppAccessContext } from "./context";

describe("getAppAccessContext", () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
  });

  it("memoizes the request-scoped Supabase lookup", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "demo@example.com" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { display_name: "Demo User", preferred_locale: "en", platform_role: null }, error: null }),
              }),
            }),
          };
        }

        if (table === "organization_memberships") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }

        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                }),
              }),
            }),
          };
        }

        if (table === "locations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        };
      }),
      storage: {
        from: () => ({ createSignedUrl: async () => ({ data: null }) }),
      },
    };

    createSupabaseServerClient.mockResolvedValue(mockSupabase);

    await expect(getAppAccessContext()).resolves.toMatchObject({
      user: { id: "user-1", email: "demo@example.com" },
      profile: { displayName: "Demo User", locale: "en", platformRole: null },
    });
    await expect(getAppAccessContext()).resolves.toMatchObject({
      user: { id: "user-1", email: "demo@example.com" },
    });
    expect(createSupabaseServerClient).toHaveBeenCalled();
    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
  });
});