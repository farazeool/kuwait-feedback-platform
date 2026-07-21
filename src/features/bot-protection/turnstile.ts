import "server-only";

import type { BotProtectionProvider } from "./verification";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function createTurnstileProvider(secret: string): BotProtectionProvider {
  return {
    async verify(token, _context, signal) {
      const response = await fetch(VERIFY_URL, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Bot verification failed");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") throw new Error("Invalid bot verification response");
      const result = payload as { success?: unknown; hostname?: unknown; action?: unknown };
      return {
        accepted: result.success === true,
        ...(typeof result.hostname === "string" ? { hostname: result.hostname } : {}),
        ...(typeof result.action === "string" ? { action: result.action } : {}),
      };
    },
  };
}
