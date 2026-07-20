import { describe, expect, it } from "vitest";

import { renderInvitationEmail } from "./email-template";

const input = { organizationName: "Demo & Co", role: "analyst", expiresAt: "2026-07-27", acceptanceUrl: "https://example.test/invite/token", personalMessage: "Welcome <script>" } as const;

describe("invitation email templates", () => {
  it("renders safe HTML and plain-text English alternatives", () => {
    const email = renderInvitationEmail({ ...input, locale: "en" });
    expect(email.subject).toContain("Demo & Co");
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain(input.acceptanceUrl);
  });

  it("renders a complete Arabic RTL alternative", () => {
    const email = renderInvitationEmail({ ...input, locale: "ar" });
    expect(email.html).toContain('dir="rtl"');
    expect(email.subject).toContain("دعوة");
    expect(email.text).toContain("قبول الدعوة");
  });
});
