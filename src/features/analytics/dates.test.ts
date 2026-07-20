import { describe, expect, it } from "vitest";

import { kuwaitCalendarDateToUtc, resolveAnalyticsRange } from "./dates";

describe("Kuwait analytics date ranges", () => {
  it("converts Kuwait midnight into the correct UTC boundary", () => {
    expect(kuwaitCalendarDateToUtc("2026-07-20").toISOString()).toBe("2026-07-19T21:00:00.000Z");
  });

  it("uses inclusive Kuwait calendar days and chooses bounded buckets", () => {
    const range = resolveAnalyticsRange({ preset: "7d", now: new Date("2026-07-20T12:00:00.000Z") });
    expect(range).toMatchObject({ from: "2026-07-14", to: "2026-07-20", bucket: "day" });
    expect(range.start).toBe("2026-07-13T21:00:00.000Z");
    expect(range.end).toBe("2026-07-20T21:00:00.000Z");
  });

  it("rejects unbounded custom ranges", () => {
    expect(() => resolveAnalyticsRange({ preset: "custom", from: "2025-01-01", to: "2026-07-20" })).toThrow(/366 days/);
  });
});
