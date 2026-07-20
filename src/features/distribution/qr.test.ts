import { describe, expect, it } from "vitest";

import { buildFeedbackUrl, isAllowedFeedbackUrl } from "./qr";

describe("feedback distribution URLs", () => {
  it("uses the configured application origin and safely encodes the public slug", () => {
    expect(buildFeedbackUrl("https://feedback.example/", "survey slug")).toBe("https://feedback.example/feedback/survey%20slug");
  });

  it("allows only same-origin feedback URLs for QR generation", () => {
    expect(isAllowedFeedbackUrl("https://feedback.example/feedback/public-id", "https://feedback.example")).toBe(true);
    expect(isAllowedFeedbackUrl("https://evil.example/feedback/public-id", "https://feedback.example")).toBe(false);
    expect(isAllowedFeedbackUrl("https://feedback.example/dashboard", "https://feedback.example")).toBe(false);
  });
});
