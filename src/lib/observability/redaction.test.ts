import { describe, expect, it } from "vitest";

import { REDACTED, redactLogMetadata } from "./redaction";

describe("structured log redaction", () => {
  it("redacts secrets and sensitive customer or operational fields recursively", () => {
    expect(redactLogMetadata({ password: "p", cookie: "c", authorization: "a", invitationToken: "t", answers: [{ text: "customer answer" }], internal_note: "private", rawIp: "127.0.0.1", safe: "kept" })).toEqual({ password: REDACTED, cookie: REDACTED, authorization: REDACTED, invitationToken: REDACTED, answers: REDACTED, internal_note: REDACTED, rawIp: REDACTED, safe: "kept" });
  });
});
