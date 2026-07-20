import { describe, expect, it } from "vitest";

import { CSV_BOM, csvLine, protectSpreadsheetCell, safeExportFilename } from "./csv";
import { exportFiltersSchema } from "@/features/analytics/schema";

describe("CSV security", () => {
  it("neutralizes spreadsheet formulas and quotes values", () => {
    expect(protectSpreadsheetCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(protectSpreadsheetCell("+1+1")).toBe('"\'+1+1"');
  });

  it("supports Arabic UTF-8 output and safe filenames", () => {
    expect(`${CSV_BOM}${csvLine(["ممتاز"])}`).toContain("ممتاز");
    expect(safeExportFilename("alert reports/../../", "2026-07-20")).toBe("kuwait-feedback-alert-reports-2026-07-20.csv");
  });

  it("preserves bounded inbox filters for permission-scoped exports", () => {
    expect(exportFiltersSchema.parse({ q: "Salmiya", rating: "2", alert: "open", unresolved: "1" })).toMatchObject({
      q: "Salmiya", rating: 2, alert: "open", unresolved: "1",
    });
    expect(exportFiltersSchema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
  });
});
