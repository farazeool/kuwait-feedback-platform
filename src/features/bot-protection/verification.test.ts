import { describe, expect, it, vi } from "vitest";

import { BotProtectionError, verifyBotChallenge } from "./verification";

const external = { verify: vi.fn().mockResolvedValue({ accepted: true }) };

describe("bot protection verification", () => {
  it("allows a controlled local disabled-provider bypass", async () => {
    await expect(verifyBotChallenge(undefined, { action: "test" }, { environment: "local", provider: "disabled", bypass: false })).resolves.toEqual({ bypassed: true });
  });

  it("denies disabled bot protection in production", async () => {
    await expect(verifyBotChallenge(undefined, { action: "test" }, { environment: "production", provider: "disabled", bypass: false })).rejects.toBeInstanceOf(BotProtectionError);
  });

  it("uses an injected provider without exposing provider details", async () => {
    await expect(verifyBotChallenge("token", { action: "test" }, { environment: "preview", provider: "turnstile", bypass: false }, external)).resolves.toEqual({ bypassed: false });
  });

  it("returns a generic failure after a provider timeout", async () => {
    const hanging = { verify: vi.fn((_token: string, _context: unknown, signal: AbortSignal) => new Promise<{ accepted: boolean }>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("timeout"))))) };
    await expect(verifyBotChallenge("token", { action: "test" }, { environment: "preview", provider: "turnstile", bypass: false, timeoutMs: 1 }, hanging)).rejects.toThrow("unavailable");
  });

  it("rejects a valid-looking token returned for another hostname or action", async () => {
    const wrongScope = { verify: vi.fn().mockResolvedValue({ accepted: true, hostname: "wrong.example.test", action: "other" }) };
    await expect(verifyBotChallenge("token", { action: "submit", expectedHostname: "app.example.test" }, { environment: "production", provider: "turnstile", bypass: false }, wrongScope)).rejects.toBeInstanceOf(BotProtectionError);
  });
});
