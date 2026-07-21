export type BotProtectionContext = { action: string; expectedHostname?: string; requestId?: string };
export type BotProtectionProvider = {
  verify: (token: string, context: BotProtectionContext, signal: AbortSignal) => Promise<{ accepted: boolean; hostname?: string; action?: string }>;
};

export type BotProtectionConfig = {
  environment: "local" | "preview" | "production";
  provider: "disabled" | "turnstile";
  bypass: boolean;
  timeoutMs?: number;
};

export class BotProtectionError extends Error {}

export async function verifyBotChallenge(
  token: string | undefined,
  context: BotProtectionContext,
  config: BotProtectionConfig,
  provider?: BotProtectionProvider,
): Promise<{ bypassed: boolean }> {
  if (config.bypass) {
    if (config.environment === "local") return { bypassed: true };
    throw new BotProtectionError("Bot protection is unavailable.");
  }
  if (config.provider === "disabled") {
    if (config.environment === "local") return { bypassed: true };
    throw new BotProtectionError("Bot protection is unavailable.");
  }
  if (!token || !provider) throw new BotProtectionError("Bot protection is unavailable.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 2_500);
  try {
    const result = await provider.verify(token, context, controller.signal);
    if (!result.accepted || (context.expectedHostname && result.hostname !== context.expectedHostname) || (context.action && result.action && result.action !== context.action)) {
      throw new BotProtectionError("Bot challenge was rejected.");
    }
    return { bypassed: false };
  } catch (error) {
    if (error instanceof BotProtectionError) throw error;
    throw new BotProtectionError("Bot protection is unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}
