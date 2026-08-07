import { describe, expect, it } from "vitest";

import { resolveSubjectLabel } from "./templates";

describe("resolveSubjectLabel", () => {
  const base = { subject_type: "employee", subject_id: "emp-1", metadata: {} };

  it("prefers an explicit metadata.label above everything else", () => {
    expect(
      resolveSubjectLabel({
        ...base,
        metadata: { label: "Front Desk" },
        employee: { display_name: "Aisha" },
      }),
    ).toBe("Front Desk");
  });

  it("falls back to the employee display name", () => {
    expect(resolveSubjectLabel({ ...base, employee: { display_name: "Aisha" } })).toBe("Aisha");
  });

  it("falls back to the location name", () => {
    expect(
      resolveSubjectLabel({
        subject_type: "location",
        subject_id: "loc-1",
        metadata: {},
        location: { name_en: "Salmiya" },
      }),
    ).toBe("Salmiya");
  });

  it("falls back to the touchpoint name", () => {
    expect(
      resolveSubjectLabel({
        subject_type: "touchpoint",
        subject_id: "tp-1",
        metadata: {},
        touchpoint: { name_en: "Checkout" },
      }),
    ).toBe("Checkout");
  });

  it("synthesizes a type:id label for a generic subject with no relations", () => {
    expect(
      resolveSubjectLabel({ subject_type: "branch", subject_id: "kw-01", metadata: {} }),
    ).toBe("branch: kw-01");
  });

  it("returns Unknown when nothing identifies the subject", () => {
    expect(resolveSubjectLabel({ subject_type: null, subject_id: null, metadata: {} })).toBe(
      "Unknown",
    );
  });

  it("ignores a non-string metadata.label", () => {
    expect(
      resolveSubjectLabel({ ...base, metadata: { label: 42 }, employee: { display_name: "Aisha" } }),
    ).toBe("Aisha");
  });
});
