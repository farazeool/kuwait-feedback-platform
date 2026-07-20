import { describe, expect, it } from "vitest";

import { formatKuwaitDateTime, KUWAIT_TIME_ZONE } from "./kuwait";

describe("Kuwait date formatting", () => {
  it("uses the fixed Asia/Kuwait business timezone", () => {
    expect(KUWAIT_TIME_ZONE).toBe("Asia/Kuwait");
    expect(formatKuwaitDateTime("2026-01-01T00:00:00Z", "en")).toContain("3:00");
  });

  it("supports Arabic output", () => {
    expect(formatKuwaitDateTime("2026-01-01T00:00:00Z", "ar")).toMatch(/[٠-٩]/);
  });
});
