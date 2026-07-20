import "server-only";

import { getServerEnv } from "@/lib/env/server";

import { BotProtectionError, type BotProtectionProvider, verifyBotChallenge } from "./verification";

export { BotProtectionError };

export async function verifyPublicSubmissionBotChallenge(
  token: string | undefined,
  provider?: BotProtectionProvider,
) {
  const env = getServerEnv();
  return verifyBotChallenge(token, { action: "public_survey_submission" }, {
    environment: env.APP_ENV,
    provider: env.BOT_PROTECTION_PROVIDER,
    bypass: env.BOT_PROTECTION_BYPASS === "true",
  }, provider);
}
