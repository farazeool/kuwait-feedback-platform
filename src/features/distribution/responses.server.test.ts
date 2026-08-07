// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
}));

const rpcMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      rpc: (...args: unknown[]) => {
        rpcMock(...args);
        return rpcMock.mock.results[rpcMock.mock.results.length - 1]?.value;
      },
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
      },
    }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("listAssignmentRatingEvents", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fetchMock.mockReset();
    getUserMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the resolved decision parameters to the RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        events: [
          {
            id: "1",
            assignment_id: "550e8400-e29b-41d4-a716-446655440000",
            organization_id: "org-1",
            rating: 5,
            label: "Excellent",
            emoji: "😀",
            created_at: "2026-08-01T12:00:00Z",
            user_agent: null,
            followup: null,
          },
        ],
        total: 1,
        channel: "email",
        template: "Default",
        assignment: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          organization_id: "org-1",
          channel: "email",
          employee_name: "Alice",
          employee_id: "emp-1",
          location_name_en: null,
          location_name_ar: null,
        },
        limit: 25,
        offset: 0,
      },
      error: null,
    });

    const { listAssignmentRatingEvents } = await import("./responses.server");
    const result = await listAssignmentRatingEvents({
      assignmentId: "550e8400-e29b-41d4-a716-446655440000",
      start: "2026-01-01T00:00:00Z",
      end: "2026-12-31T00:00:00Z",
      limit: 50,
    });

    expect(result.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0]!;
    expect(name).toBe("list_assignment_rating_events");
    expect(args).toMatchObject({
      p_assignment_id: "550e8400-e29b-41d4-a716-446655440000",
      p_start_at: "2026-01-01T00:00:00.000Z",
      p_end_at: "2026-12-31T00:00:00.000Z",
      p_limit: 50,
    });
  });

  it("returns a 400 with a typed message when the assignmentId is missing", async () => {
    const { listAssignmentRatingEvents } = await import("./responses.server");
    const result = await listAssignmentRatingEvents({ assignmentId: "" });
    expect(result).toEqual({ ok: false, status: 400, error: "Assignment id is required" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns a 403 when the RPC reports an authorization failure", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "RLS denied" } });
    const { listAssignmentRatingEvents } = await import("./responses.server");
    const result = await listAssignmentRatingEvents({
      assignmentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).toEqual({ ok: false, status: 403, error: "forbidden" });
  });

  it("returns a 404 when the RPC envelope is empty (no assignment row)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { listAssignmentRatingEvents } = await import("./responses.server");
    const result = await listAssignmentRatingEvents({
      assignmentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result).toEqual({ ok: false, status: 404, error: "not_found" });
  });
});