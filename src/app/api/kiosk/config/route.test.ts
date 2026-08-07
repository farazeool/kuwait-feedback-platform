import { test, expect, describe, vi, beforeEach, Mock } from "vitest";
import { NextRequest } from "next/server";

// The route now reads the credential directly from `next/headers` cookies,
// so the test must mock that module rather than an indirect helper.
const cookieStoreMock = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(cookieStoreMock)),
}));

// The route imports the service-role client directly; mock it so we never
// touch the real `server-only` module or pull in getServerEnv.
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));

import { GET } from "./route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const mockSupabase = {
  rpc: vi.fn(),
};

describe("API GET /api/kiosk/config", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (createSupabaseServiceRoleClient as Mock).mockReturnValue(mockSupabase);
  });

  const mockRequest = () =>
    new NextRequest("http://localhost/api/kiosk/config", {});

  test("should return 401 if no credential is provided", async () => {
    cookieStoreMock.get.mockReturnValue(undefined);
    const response = await GET(mockRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("should return 404 if credential does not resolve to a configuration", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "unknown-credential" });
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [],
      error: { message: "Invalid credential" },
    });
    const response = await GET(mockRequest());
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Invalid credential or device not found");
  });

  test("should return 404 if RPC returns empty data without error", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "missing-credential" });
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });
    const response = await GET(mockRequest());
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Kiosk configuration not found.");
  });

  test("should return allowlisted config fields on success", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "valid-credential" });
    const mockDbRow = {
      desired_config_version: 2,
      applied_config_version: 1,
      desired_survey_id: "survey-b",
      applied_survey_id: "survey-a",
      desired_mode: "active",
      applied_mode: "active",
      configuration_updated_at: "2026-08-06T12:00:00.000Z",
      configuration_applied_at: "2026-08-06T11:00:00.000Z",
      configuration_error: null,
      // Extra fields that should be filtered out by the allowlist
      internal_secret: "do-not-expose",
      organization_id: "org-id",
    };
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [mockDbRow],
      error: null,
    });

    const response = await GET(mockRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      desiredConfigVersion: 2,
      appliedConfigVersion: 1,
      desiredSurveyId: "survey-b",
      appliedSurveyId: "survey-a",
      desiredMode: "active",
      appliedMode: "active",
      configurationUpdatedAt: mockDbRow.configuration_updated_at,
      configurationAppliedAt: mockDbRow.configuration_applied_at,
      configurationStatus: "pending",
      configurationError: null,
    });

    expect(body).not.toHaveProperty("internal_secret");
    expect(body).not.toHaveProperty("organization_id");
  });
});
