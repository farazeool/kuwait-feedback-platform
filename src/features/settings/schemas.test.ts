import { describe, expect, it } from "vitest";
import { detectBrandImage, organizationSettingsSchema } from "./schemas";

describe("settings validation", () => {
  it("rejects unsafe logo content regardless of filename", () => {
    expect(detectBrandImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectBrandImage(Uint8Array.from([137,80,78,71,13,10,26,10]))?.mime).toBe("image/png");
  });
  it("requires HTTPS websites and safe Kuwait-compatible contacts", () => {
    const base = { nameEn: "Demo", nameAr: "تجريبي", slug: "demo", businessCategory: "retail", phone: "+96512345678", email: "hello@example.test", website: "http://unsafe.test", descriptionEn: "", descriptionAr: "", defaultLocale: "en", dateFormat: "dd/MM/yyyy", numberFormat: "en-KW", supportEmail: "", supportPhone: "" };
    expect(organizationSettingsSchema.safeParse(base).success).toBe(false);
  });
});
