import "server-only";

import { getServerEnv } from "@/lib/env/server";

import { BotProtectionError, type BotProtectionProvider, verifyBotChallenge } from "./verification";
import { createTurnstileProvider } from "./turnstile";

export { BotProtectionError };

export async function verifyPublicSubmissionBotChallenge(
  token: string | undefined,
  provider?: BotProtectionProvider,
) {
  const env = getServerEnv();
  const configuredProvider = provider ?? (env.BOT_PROTECTION_PROVIDER === "turnstile" && env.BOT_PROTECTION_SECRET_KEY
    ? createTurnstileProvider(env.BOT_PROTECTION_SECRET_KEY)
    : undefined);
  return verifyBotChallenge(token, { action: env.BOT_PROTECTION_EXPECTED_ACTION, expectedHostname: env.BOT_PROTECTION_EXPECTED_HOSTNAME }, {
    environment: env.APP_ENV,
    provider: env.BOT_PROTECTION_PROVIDER,
    bypass: env.BOT_PROTECTION_LOCAL_BYPASS === "true",
  }, configuredProvider);
}
