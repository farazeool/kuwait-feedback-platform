import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, POST } from "./route";

// Regression test for activation code generation failure
// Issue 1: The RPC regenerate_activation_code was using auth.uid() which returns NULL
// when called from server-side API routes, causing authorization to fail.
// Issue 2: The RPC returned timestamp without time zone instead of timestamptz,
// causing PostgreSQL error: "Returned type timestamp without time zone does not match expected type timestamp with time zone"

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("POST /api/admin/kiosks/[id]/activation", () => {
  const mockUser = { id: "10000000-0000-4000-8000-000000000001" };
  const mockKiosk = {
    id: "cc4352d5-8673-4054-ae97-ba6fe0f85f9a",
    organization_id: "20000000-0000-4000-8000-000000000001",
    status: "pending_activation",
    device_name: "Test Device",
  };
  const mockMembership = { role: "organization_admin" };
  const mockActivationData = {
    activation_code: "ABC123",
    activation_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const createMockSupabase = () => {
    const mockFrom = vi.fn();
    const mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: mockFrom,
      rpc: vi.fn(),
    };
    return mockSupabase;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass user ID to regenerate_activation_code RPC", async () => {
    const mockSupabase = createMockSupabase();

    // Setup auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Setup kiosk lookup
    const mockKioskSingle = vi.fn().mockResolvedValue({
      data: mockKiosk,
      error: null,
    });

    // Setup membership lookup
    const mockMembershipSingle = vi.fn().mockResolvedValue({
      data: mockMembership,
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kiosk_devices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockKioskSingle,
            }),
          }),
        };
      }
      if (table === "organization_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockMembershipSingle,
              }),
            }),
          }),
        };
      }
      return {} as ReturnType<typeof vi.fn>;
    });

    // Setup RPC - this is the critical test
    // The RPC must receive p_user_id for authorization to work
    mockSupabase.rpc.mockResolvedValue({
      data: mockActivationData,
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks/test/activation", {
      method: "POST",
    });
    const params = Promise.resolve({ id: mockKiosk.id });

    const response = await POST(request, { params });
    const result = await response.json();

    // Verify the RPC was called with the user ID
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "regenerate_activation_code",
      expect.objectContaining({
        p_device_id: mockKiosk.id,
        p_organization_id: mockKiosk.organization_id,
        p_user_id: mockUser.id, // Critical: user ID must be passed
      })
    );

    // Verify success response
    expect(response.status).toBe(200);
    expect(result).toHaveProperty("code", mockActivationData.activation_code);
    expect(result).toHaveProperty("activation_url");
    expect(result).toHaveProperty("expires_at");
  });

  it("should return 401 when user is not authenticated", async () => {
    const mockSupabase = createMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks/test/activation", {
      method: "POST",
    });
    const params = Promise.resolve({ id: mockKiosk.id });

    const response = await POST(request, { params });
    expect(response.status).toBe(401);
  });

  it("should return 404 when kiosk not found", async () => {
    const mockSupabase = createMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks/test/activation", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "non-existent-id" });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  // Regression test for timestamp type mismatch error
  // Error: "Returned type timestamp without time zone does not match expected type timestamp with time zone"
  // The RPC function must return timestamptz, not timestamp
  it("should handle timestamptz from RPC without type mismatch error", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Setup kiosk lookup
    const mockKioskSingle = vi.fn().mockResolvedValue({
      data: mockKiosk,
      error: null,
    });

    // Setup membership lookup
    const mockMembershipSingle = vi.fn().mockResolvedValue({
      data: mockMembership,
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kiosk_devices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockKioskSingle,
            }),
          }),
        };
      }
      if (table === "organization_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockMembershipSingle,
              }),
            }),
          }),
        };
      }
      return {} as ReturnType<typeof vi.fn>;
    });

    // Simulate the exact response structure from the fixed RPC
    // The expires_at must be a proper ISO string (timestamptz)
    const mockActivationDataWithTimestamptz = {
      activation_code: "ABC123",
      activation_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockSupabase.rpc.mockResolvedValue({
      data: mockActivationDataWithTimestamptz,
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks/test/activation", {
      method: "POST",
    });
    const params = Promise.resolve({ id: mockKiosk.id });

    const response = await POST(request, { params });
    const result = await response.json();

    // Verify the response contains valid timestamptz
    expect(response.status).toBe(200);
    expect(result).toHaveProperty("code");
    expect(result).toHaveProperty("expires_at");
    // Verify the expires_at is a valid date string
    expect(() => new Date(result.expires_at)).not.toThrow();
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("should return 403 when user lacks organization membership", async () => {
    const mockSupabase = createMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockKioskSingle = vi.fn().mockResolvedValue({
      data: mockKiosk,
      error: null,
    });
    const mockMembershipSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kiosk_devices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockKioskSingle,
            }),
          }),
        };
      }
      if (table === "organization_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockMembershipSingle,
              }),
            }),
          }),
        };
      }
      return {} as ReturnType<typeof vi.fn>;
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks/test/activation", {
      method: "POST",
    });
    const params = Promise.resolve({ id: mockKiosk.id });

    const response = await POST(request, { params });
    expect(response.status).toBe(403);
  });

  // ---------------------------------------------------------------------
  // Regression tests for the PostgREST array-response defect.
  //
  // `regenerate_activation_code` is declared RETURNS TABLE, so PostgREST
  // serialises the result as an ARRAY of rows. The route previously cast that
  // array straight to an object, so `activation_code` and
  // `activation_code_expires_at` both read as `undefined` — producing the blank
  // Activation Code and the "N/A" expiry under an "Activation Ready" heading.
  // ---------------------------------------------------------------------

  /** Wires auth + kiosk + privileged membership, and a scripted RPC result. */
  const setupAuthorized = (rpcResult: { data: unknown; error: unknown }) => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kiosk_devices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockKiosk, error: null }),
            }),
          }),
        };
      }
      if (table === "organization_memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockMembership, error: null }),
              }),
            }),
          }),
        };
      }
      return {} as ReturnType<typeof vi.fn>;
    });

    mockSupabase.rpc.mockResolvedValue(rpcResult);

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<
        ReturnType<typeof createSupabaseServerClient>
      >
    );

    return mockSupabase;
  };

  const callPost = async () => {
    const request = new NextRequest(
      "http://localhost:3001/api/admin/kiosks/test/activation",
      { method: "POST" }
    );
    return POST(request, { params: Promise.resolve({ id: mockKiosk.id }) });
  };

  it("unwraps the single-row ARRAY returned by the RETURNS TABLE RPC", async () => {
    setupAuthorized({ data: [mockActivationData], error: null });

    const response = await callPost();
    const result = await response.json();

    expect(response.status).toBe(200);
    // The exact defect: these were previously undefined -> blank code, N/A expiry.
    expect(result.code).toBe(mockActivationData.activation_code);
    expect(result.code).not.toBe("");
    expect(result.expires_at).toBe(
      mockActivationData.activation_code_expires_at
    );
    expect(result.activation_url).toContain(
      `code=${mockActivationData.activation_code}`
    );
  });

  it("fails instead of reporting ready when the RPC returns zero rows", async () => {
    setupAuthorized({ data: [], error: null });

    const response = await callPost();
    const result = await response.json();

    expect(response.status).toBe(409);
    expect(result).not.toHaveProperty("code");
    expect(result.error).toBeTruthy();
  });

  it("fails instead of reporting ready when the row has no activation code", async () => {
    setupAuthorized({
      data: [
        {
          activation_code: null,
          activation_code_expires_at: mockActivationData.activation_code_expires_at,
        },
      ],
      error: null,
    });

    const response = await callPost();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result).not.toHaveProperty("code");
  });

  it("fails instead of returning an N/A expiry when the row has no expiry", async () => {
    setupAuthorized({
      data: [{ activation_code: "ABC123", activation_code_expires_at: null }],
      error: null,
    });

    const response = await callPost();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result).not.toHaveProperty("expires_at");
  });

  it("refuses an ambiguous multi-row response", async () => {
    setupAuthorized({
      data: [mockActivationData, mockActivationData],
      error: null,
    });

    expect((await callPost()).status).toBe(502);
  });

  it("never leaks raw database error detail to the administrator", async () => {
    setupAuthorized({
      data: null,
      error: {
        message: 'permission denied for function regenerate_activation_code',
        code: "42501",
        details: "internal detail",
      },
    });

    const response = await callPost();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.error).not.toContain("42501");
    expect(result.error).not.toContain("permission denied");
    expect(result.error).not.toContain("regenerate_activation_code");
    expect(result.error).not.toContain("internal detail");
  });

  // Organization membership alone must not be enough to mint credentials.
  it("returns 403 for a member whose role is not privileged", async () => {
    const mockSupabase = createMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kiosk_devices") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockKiosk, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { role: "viewer" }, error: null }),
            }),
          }),
        }),
      };
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<
        ReturnType<typeof createSupabaseServerClient>
      >
    );

    const response = await callPost();

    expect(response.status).toBe(403);
    // The privileged RPC must never have been reached.
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

// The DELETE endpoint previously answered `{ success: true }` without revoking
// anything, telling operators a link had been invalidated when it had not.
describe("DELETE /api/admin/kiosks/[id]/activation", () => {
  it("does not claim a revocation that did not happen", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "kiosk_devices") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "k1",
                    organization_id: "o1",
                    status: "pending_activation",
                    device_name: "Test",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "organization_admin" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }),
      rpc: vi.fn(),
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<
        ReturnType<typeof createSupabaseServerClient>
      >
    );

    const request = new NextRequest(
      "http://localhost:3001/api/admin/kiosks/k1/activation",
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "k1" }),
    });
    const result = await response.json();

    expect(response.ok).toBe(false);
    expect(result.success).toBeUndefined();
    expect(result.revoked).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
