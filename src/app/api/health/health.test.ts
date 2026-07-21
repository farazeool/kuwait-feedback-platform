import { describe, expect, it } from "vitest";

import { GET as live } from "./live/route";

describe("health endpoints", () => {
  it("liveness reveals no implementation detail", async () => {
    const response = live();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
