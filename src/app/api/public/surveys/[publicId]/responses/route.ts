import { NextResponse, type NextRequest } from "next/server";

import {
  submissionPayloadSchema,
  toDatabaseAnswers,
  validateAnswersForSurvey,
} from "@/features/public-feedback/schema";
import { getPublicSurvey } from "@/features/public-feedback/server";
import {
  createSubmissionFingerprint,
  isAllowedSubmissionOrigin,
  isRealisticCompletionTime,
  isWithinSubmissionBodyLimit,
  MAX_SUBMISSION_BODY_BYTES,
  readSubmissionBody,
} from "@/features/public-feedback/security";
import { getServerEnv } from "@/lib/env/server";
import { logEvent } from "@/lib/observability/logger";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { BotProtectionError, verifyPublicSubmissionBotChallenge } from "@/features/bot-protection/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const env = getServerEnv();
  if (!isAllowedSubmissionOrigin(request.headers.get("origin"), env.NEXT_PUBLIC_APP_URL)) {
    return genericError(403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return genericError(415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SUBMISSION_BODY_BYTES) return genericError(413);

  let raw: string | null = "";
  try {
    raw = await readSubmissionBody(request.body);
  } catch {
    return genericError(400);
  }
  if (raw === null) return genericError(413);
  if (!isWithinSubmissionBodyLimit(raw, declaredLength)) return genericError(413);

  let input: unknown;
  try { input = JSON.parse(raw); } catch { return genericError(400); }
  const parsed = submissionPayloadSchema.safeParse(input);
  if (!parsed.success || parsed.data.website !== "") return genericError(400);

  if (!isRealisticCompletionTime(parsed.data.startedAt, Date.now())) return genericError(400);

  try {
    await verifyPublicSubmissionBotChallenge(parsed.data.botToken);
  } catch (error) {
    logEvent("public_feedback_bot_rejected", { publicId, reason: error instanceof BotProtectionError ? "verification" : "unavailable" });
    return genericError(503);
  }

  const survey = await getPublicSurvey(publicId);
  if (!survey || !validateAnswersForSurvey(survey, parsed.data)) return genericError(400);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = createSubmissionFingerprint(env.SUBMISSION_FINGERPRINT_SECRET, {
    forwardedFor: forwarded,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    acceptLanguage: request.headers.get("accept-language") ?? "",
  });
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("submit_protected_survey_response", {
    p_public_slug: publicId,
    p_locale: parsed.data.locale,
    p_answers: toDatabaseAnswers(parsed.data),
    p_idempotency_key: parsed.data.idempotencyKey,
    p_fingerprint_hash: fingerprint,
    p_channel: parsed.data.channel ?? "web",
    p_touchpoint_token: parsed.data.touchpointToken ?? undefined,
  });

  if (error) {
    logEvent("public_feedback_rejected", { publicId, reason: error.code === "P0001" ? "rate_limit" : "database_validation" });
    return genericError(error.code === "P0001" ? 429 : 400);
  }
  const result = data as { duplicate?: boolean } | null;
  logEvent("public_feedback_accepted", { publicId, duplicate: Boolean(result?.duplicate) });
  return NextResponse.json({ ok: true, duplicate: Boolean(result?.duplicate) }, { status: result?.duplicate ? 200 : 201 });
}

function genericError(status: number) {
  return NextResponse.json({ error: "Feedback could not be submitted" }, { status });
}
