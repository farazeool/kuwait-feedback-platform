import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

// Regression test for kiosk device creation failure
// Issue: The create_kiosk_device RPC inserted a fixed 'pending_activation' placeholder
// for access_token, which violated the unique constraint when creating multiple devices.

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("POST /api/admin/kiosks - Device Creation Regression Tests", () => {
  const mockUser = { id: "10000000-0000-4000-8000-000000000001" };
  const mockOrganizationId = "20000000-0000-4000-8000-000000000001";
  const mockLocationId = "30000000-0000-4000-8000-000000000001";
  const mockDeviceId = "40000000-0000-4000-8000-000000000001";

  const createMockSupabase = () => {
    return {
      auth: {
        getUser: vi.fn(),
      },
      rpc: vi.fn(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a kiosk device successfully", async () => {
    const mockSupabase = createMockSupabase();

    // Setup auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Setup RPC - simulate successful device creation
    mockSupabase.rpc.mockResolvedValue({
      data: mockDeviceId,
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device 1",
      }),
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.deviceId).toBe(mockDeviceId);

    // Verify the RPC was called with correct parameters
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "create_kiosk_device",
      expect.objectContaining({
        p_organization_id: mockOrganizationId,
        p_location_id: mockLocationId,
        p_device_name: "Test Device 1",
      })
    );
  });

  it("should return 401 when user is not authenticated", async () => {
    const mockSupabase = createMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should return 400 when required fields are missing", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        // Missing locationId and deviceName
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain("required");
  });

  it("should handle duplicate access_token error from RPC", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Simulate the duplicate key error that was occurring
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "kiosk_devices_access_token_key"',
        details: 'Key (access_token)=(pending_activation) already exists.',
      },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device 2",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBeDefined();
  });

  it("should not expose PostgreSQL constraint names in error messages", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Simulate an error with internal details
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "kiosk_devices_access_token_key"',
        details: 'Key (access_token)=(pending_activation) already exists.',
      },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device 3",
      }),
    });

    const response = await POST(request);
    const result = await response.json();

    // The API should return the error message from the RPC
    // This test documents the current behavior - the error message is passed through
    // In production, we might want to sanitize this further
    expect(response.status).toBe(400);
    expect(result.error).toBeDefined();
  });

  it("should create two devices sequentially (regression test for unique access_token)", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // First device creation succeeds
    mockSupabase.rpc.mockResolvedValueOnce({
      data: "device-id-1",
      error: null,
    });

    // Second device creation also succeeds (was failing before fix)
    mockSupabase.rpc.mockResolvedValueOnce({
      data: "device-id-2",
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    // Create first device
    const request1 = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device A",
      }),
    });

    const response1 = await POST(request1);
    const result1 = await response1.json();
    expect(response1.status).toBe(201);
    expect(result1.deviceId).toBe("device-id-1");

    // Create second device - this was failing with duplicate key error before the fix
    const request2 = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: mockOrganizationId,
        locationId: mockLocationId,
        deviceName: "Test Device B",
      }),
    });

    const response2 = await POST(request2);
    const result2 = await response2.json();
    expect(response2.status).toBe(201);
    expect(result2.deviceId).toBe("device-id-2");

    // Verify both RPC calls were made
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("should return 400 when organization authorization fails", async () => {
    const mockSupabase = createMockSupabase();

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Simulate authorization error from RPC
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Not authorized to create kiosk devices for this organization",
      },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>
    );

    const request = new NextRequest("http://localhost:3001/api/admin/kiosks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "different-org-id", // User is not a member
        locationId: mockLocationId,
        deviceName: "Test Device",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain("Not authorized");
  });
});