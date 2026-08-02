import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    SUBMISSION_FINGERPRINT_SECRET: "test-secret-key",
  }),
}));

vi.mock("@/lib/supabase/anonymous", () => ({
  createSupabaseAnonymousClient: vi.fn(),
}));

vi.mock("@/features/public-feedback/security", async () => {
  const actual = await vi.importActual("@/features/public-feedback/security");
  return {
    ...actual,
    isAllowedSubmissionOrigin: vi.fn(() => true),
    isWithinSubmissionBodyLimit: vi.fn(() => true),
    readSubmissionBody: vi.fn(async () => JSON.stringify({
      token: "abcd1234abcd5678abcd9012",
      rating: 3,
      nonce: "abcd1234abcd5678abcd9012abcd1234abcd",
      website: "",
    })),
    createSubmissionFingerprint: vi.fn(() => "test-fingerprint"),
    MAX_SUBMISSION_BODY_BYTES: 10240,
  };
});

import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { isAllowedSubmissionOrigin, readSubmissionBody } from "@/features/public-feedback/security";

describe("POST /api/feedback/rate", () => {
  const createMockRequest = (body: object = {}) => {
    return new NextRequest("http://localhost:3000/api/feedback/rate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": JSON.stringify(body).length.toString(),
        "origin": "http://localhost:3000",
        "user-agent": "test-agent",
      },
      body: JSON.stringify(body),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mocks after clear
    vi.mocked(isAllowedSubmissionOrigin).mockReturnValue(true);
  });

  describe("Success path", () => {
    it("returns HTTP 200 and {ok:true} when record_rating returns recorded=true", async () => {
      const mockRpc = vi.fn().mockResolvedValue({ 
        data: { ok: true, recorded: true },
        error: null 
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "abcd1234efgh5678ijkl9012";
      const validNonce = "a1b2c3d4e5f67890abcdef1234567890abcd";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 4,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 4,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ ok: true });
      expect(mockRpc).toHaveBeenCalledWith("record_rating", expect.objectContaining({
        p_public_token: validToken,
        p_rating: 4,
        p_nonce: validNonce,
      }));
    });
  });

  describe("Safe rejection (no persistence)", () => {
    it("returns HTTP 409 when RPC returns recorded=false", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { ok: true, recorded: false },
        error: null,
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "consumed123456789abcdefgh";
      const validNonce = "abcd1234abcd5678abcd9012abcd1234abcd"; // 36 hex chars

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      // Verify RPC was called (proves we reached the RPC branch)
      expect(mockRpc).toHaveBeenCalledOnce();
      expect(response.status).toBe(409);
      expect(json).toEqual({ ok: false, error: "Unable to record feedback" });
      expect(json.ok).not.toBe(true);
    });

    it("must NOT return {ok:true} when recorded=false", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { ok: true, recorded: false },
        error: null,
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "invalidtoken1234567890abc";
      const validNonce = "1234567890abcdef1234567890abcdef1234"; // 36 hex chars

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      // Verify RPC was called (proves we reached the RPC branch)
      expect(mockRpc).toHaveBeenCalledOnce();
      // Critical: must never return success when recorded=false
      expect(json.ok).not.toBe(true);
      expect(response.status).toBe(409);
    });
  });

  describe("Rate limit error (P0001)", () => {
    it("returns HTTP 429 when RPC returns P0001 code", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        error: { code: "P0001", message: "Rate limit exceeded" },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "token123456789abcdefghij";
      const validNonce = "111111112222333344445555666677778888";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(429);
      expect(json).toEqual({ error: "Too many requests" });
    });

    it("does NOT return {ok:true} for rate limit", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        error: { code: "P0001" },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "token987654321zyxwvutsrq";
      const validNonce = "aaaaaaaabbbbccccddddeeeeffffaaaabbbb";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).not.toEqual({ ok: true });
      expect(json.ok).toBeUndefined();
    });
  });

  describe("Database failure (non-P0001 errors)", () => {
    it("returns HTTP 503 and {ok:false} for generic database error", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        error: { code: "PGRST116", message: "Database connection error" },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "errortoken123456789abcde";
      const validNonce = "fedcba9876543210fedcba9876543210fedc";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 5,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 5,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json).toEqual({ ok: false, error: "Unable to record feedback" });
    });

    it("must NOT return {ok:true} for database failures", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        error: { code: "23505", message: "Duplicate key violation" },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "duplicatetoken1234567890";
      const validNonce = "bbbbbbbbccccddddeeeeffffbbbbbbbbcccc";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 1,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 1,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      // Critical assertion: MUST NOT return false success
      expect(json.ok).not.toBe(true);
      expect(json.ok).toBe(false);
      expect(response.status).toBe(503);
    });

    it("does not expose internal database error details", async () => {
      // Ensure origin check passes for this test
      vi.mocked(isAllowedSubmissionOrigin).mockReturnValue(true);
      
      const mockRpc = vi.fn().mockResolvedValue({
        error: {
          code: "42P01",
          message: "relation 'rating_events' does not exist",
          details: "SQL error at line 42",
        },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "sqlerrortoken123456789abc"; // Fixed: valid length
      const validNonce = "ccccccccddddeeeeffffccccccccddddeeee";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json).toEqual({ ok: false, error: "Unable to record feedback" });
      // Ensure no internal details leaked
      expect(JSON.stringify(json)).not.toContain("relation");
      expect(JSON.stringify(json)).not.toContain("SQL");
      expect(JSON.stringify(json)).not.toContain("42P01");
    });

    it("returns HTTP 503 for nonce validation failures", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        error: { code: "22000", message: "Invalid nonce" },
      });
      vi.mocked(createSupabaseAnonymousClient).mockReturnValue({
        rpc: mockRpc,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const validToken = "noncetoken12345678901234";
      const validNonce = "ddddddddeeeeffffddddddddeeeeffffdddd";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 2,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(json).toEqual({ ok: false, error: "Unable to record feedback" });
    });
  });

  describe("Security validations", () => {
    it("returns generic rejection for invalid origin (no false Thank You)", async () => {
      vi.mocked(isAllowedSubmissionOrigin).mockReturnValue(false);

      const validToken = "securitytoken123456789ab";
      const validNonce = "eeeeeeeeffffeeeeeeeeffffeeeeeeeeeeee";

      const request = createMockRequest({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "",
      });

      const response = await POST(request);
      const json = await response.json();

      // HTTP 200 to prevent information leakage about why request failed
      expect(response.status).toBe(200);
      // But ok: false so client does NOT show false Thank You screen
      expect(json).toEqual({ ok: false });
      expect(createSupabaseAnonymousClient).not.toHaveBeenCalled();
    });

    it("returns generic rejection for honeypot trap (no false Thank You)", async () => {
      const validToken = "honeypottoken1234567890";
      const validNonce = "fffffffffffffffffffffffffffffffff000";

      vi.mocked(readSubmissionBody).mockResolvedValue(JSON.stringify({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "bot-filled-this",
      }));

      const request = createMockRequest({
        token: validToken,
        rating: 3,
        nonce: validNonce,
        website: "bot-filled-this",
      });

      const response = await POST(request);
      const json = await response.json();

      // HTTP 200 to prevent information leakage about why request failed
      expect(response.status).toBe(200);
      // But ok: false so client does NOT show false Thank You screen
      expect(json).toEqual({ ok: false });
      expect(createSupabaseAnonymousClient).not.toHaveBeenCalled();
    });
  });
});
