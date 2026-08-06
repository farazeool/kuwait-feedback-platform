import { test, expect, describe, vi, beforeEach, Mock } from "vitest";
import { GET } from "./route";
import { getKioskFromCredential } from "@/features/kiosk/enrollment-http";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

vi.mock("@/features/kiosk/enrollment-http", () => ({
  getKioskFromCredential: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleSupabaseClient: vi.fn(),
}));

const mockSupabase = {
  rpc: vi.fn(),
};

describe("API GET /api/kiosk/config", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (createServiceRoleSupabaseClient as Mock).mockReturnValue(mockSupabase);
  });

  const mockRequest = (cookie: string = "") =>
    new NextRequest("http://localhost/api/kiosk/config", {
      headers: { cookie },
    });

  test("should return 401 if no credential is provided", async () => {
    const req = mockRequest();
    (getKioskFromCredential as Mock).mockResolvedValueOnce(null);
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid or expired kiosk credential.");
  });

  test("should return 401 if credential is for a revoked device", async () => {
    const req = mockRequest("kiosk-credential=revoked-credential");
    (getKioskFromCredential as Mock).mockResolvedValueOnce({
      id: "kiosk-id",
      status: "revoked",
    });
    const response = await GET(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Kiosk is revoked.");
  });

  test("should return 500 if database RPC fails", async () => {
    const req = mockRequest("kiosk-credential=valid-credential");
    (getKioskFromCredential as Mock).mockResolvedValueOnce({
      id: "kiosk-id",
      status: "active",
      organization_id: "org-id",
    });
    mockSupabase.rpc.mockResolvedValueOnce({
      error: { message: "Database error" },
      data: null,
    });
    const response = await GET(req);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to fetch kiosk configuration.");
  });

  test("should return 404 if RPC returns no data", async () => {
    const req = mockRequest("kiosk-credential=valid-credential");
    (getKioskFromCredential as Mock).mockResolvedValueOnce({
      id: "kiosk-id",
      status: "active",
      organization_id: "org-id",
    });
    mockSupabase.rpc.mockResolvedValueOnce({ error: null, data: null });
    const response = await GET(req);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Kiosk configuration not found.");
  });

  test("should return allowlisted config fields on success", async () => {
    const req = mockRequest("kiosk-credential=valid-credential");
    (getKioskFromCredential as Mock).mockResolvedValueOnce({
      id: "kiosk-id",
      status: "active",
      organization_id: "org-id",
    });

    const mockDbResponse = {
      desired_config_version: 2,
      applied_config_version: 1,
      desired_survey_id: "survey-b",
      applied_survey_id: "survey-a",
      desired_mode: "active",
      applied_mode: "active",
      configuration_updated_at: new Date().toISOString(),
      configuration_applied_at: new Date().toISOString(),
      configuration_status: "pending",
      configuration_error: null,
      // Extra fields that should be filtered out
      internal_secret: "do-not-expose",
      org_id: "org-id",
    };
    mockSupabase.rpc.mockResolvedValueOnce({
      error: null,
      data: [mockDbResponse],
    });

    const response = await GET(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      desiredConfigVersion: 2,
      appliedConfigVersion: 1,
      desiredSurveyId: "survey-b",
      appliedSurveyId: "survey-a",
      desiredMode: "active",
      appliedMode: "active",
      configurationUpdatedAt: mockDbResponse.configuration_updated_at,
      configurationAppliedAt: mockDbResponse.configuration_applied_at,
      configurationStatus: "pending",
      configurationError: null,
    });

    expect(body).not.toHaveProperty("internal_secret");
    expect(body).not.toHaveProperty("org_id");
  });
});
