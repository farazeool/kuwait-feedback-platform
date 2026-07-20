import { describe, expect, it } from "vitest";
import { signUpSchema } from "./schemas";

describe("invitation-compatible account creation", () => {
  it("normalizes email and retains only a local continuation path", () => {
    const result = signUpSchema.parse({ email: " Invitee@Example.Test ", password: "a-secure-password", next: "/invite/abcdef" });
    expect(result.email).toBe("invitee@example.test");
    expect(result.next).toBe("/invite/abcdef");
  });

  it("rejects external continuation URLs", () => {
    expect(signUpSchema.safeParse({ email: "invitee@example.test", password: "a-secure-password", next: "https://evil.test" }).success).toBe(false);
  });
});
