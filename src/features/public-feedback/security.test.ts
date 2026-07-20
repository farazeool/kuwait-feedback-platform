import { describe, expect, it } from "vitest";

import {
  createSubmissionFingerprint,
  isAllowedSubmissionOrigin,
  isRealisticCompletionTime,
  isWithinSubmissionBodyLimit,
  MAX_SUBMISSION_BODY_BYTES,
  readSubmissionBody,
} from "./security";

describe("anonymous request protection", () => {
  it("rejects declared and actual bodies above 64 KiB", () => {
    expect(isWithinSubmissionBodyLimit("{}", MAX_SUBMISSION_BODY_BYTES + 1)).toBe(false);
    expect(isWithinSubmissionBodyLimit("x".repeat(MAX_SUBMISSION_BODY_BYTES + 1))).toBe(false);
  });

  it("stops reading a streaming request once its size limit is crossed", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1234"));
        controller.enqueue(new TextEncoder().encode("5678"));
        controller.close();
      },
    });
    await expect(readSubmissionBody(body, 6)).resolves.toBeNull();
  });

  it("enforces realistic completion timing", () => {
    expect(isRealisticCompletionTime(1_000, 2_499)).toBe(false);
    expect(isRealisticCompletionTime(1_000, 2_500)).toBe(true);
    expect(isRealisticCompletionTime(1_000, 1_000 + 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });

  it("rejects cross-origin browser submissions", () => {
    expect(isAllowedSubmissionOrigin("https://feedback.example", "https://feedback.example/app")).toBe(true);
    expect(isAllowedSubmissionOrigin("https://attacker.example", "https://feedback.example")).toBe(false);
    expect(isAllowedSubmissionOrigin(null, "https://feedback.example")).toBe(true);
  });

  it("creates a stable keyed hash without retaining the raw address", () => {
    const fingerprint = createSubmissionFingerprint("s".repeat(32), { forwardedFor: "192.0.2.10", userAgent: "test", acceptLanguage: "ar" });
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("192.0.2.10");
  });
});
