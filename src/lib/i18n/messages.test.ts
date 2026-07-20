import { describe, expect, it } from "vitest";

import { ar, en, getMessages } from "./messages";

describe("translation catalog", () => {
  it("has exact English and Arabic key parity", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(ar).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("does not mix English navigation into Arabic mode", () => {
    const messages = getMessages("ar");
    expect([messages["nav.overview"], messages["nav.team"], messages["nav.settings"]]).toEqual(["نظرة عامة", "الفريق", "الإعدادات"]);
  });
});
