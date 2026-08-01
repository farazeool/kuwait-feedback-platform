import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

import { countKioskDevices } from "./count";

describe("countKioskDevices", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 0 without querying when there is no organization", async () => {
    await expect(countKioskDevices(null)).resolves.toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("counts the devices returned for the organization", async () => {
    rpc.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });

    await expect(countKioskDevices("org-1")).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith("list_kiosk_devices", {
      p_organization_id: "org-1",
    });
  });

  it("returns 0 for an organization with no devices", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(countKioskDevices("org-1")).resolves.toBe(0);
  });

  it("degrades to 0 when the RPC fails rather than throwing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(countKioskDevices("org-1")).resolves.toBe(0);
  });

  it("degrades to 0 when the RPC returns a non-array payload", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(countKioskDevices("org-1")).resolves.toBe(0);
  });
});
