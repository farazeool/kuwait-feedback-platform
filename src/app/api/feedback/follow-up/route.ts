import { NextResponse, type NextRequest } from "next/server";

import { ratingFollowupSubmissionSchema } from "@/features/distribution/schema";
import {
  createSubmissionFingerprint,
  isAllowedSubmissionOrigin,
  isWithinSubmissionBodyLimit,
  MAX_SUBMISSION_BODY_BYTES,
  readSubmissionBody,
} from "@/features/public-feedback/security";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const env = getServerEnv();

  if (!isAllowedSubmissionOrigin(request.headers.get("origin"), env.NEXT_PUBLIC_APP_URL)) {
    return genericOk();
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return genericOk();
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SUBMISSION_BODY_BYTES) {
    return genericOk();
  }

  let raw: string | null = "";
  try {
    raw = await readSubmissionBody(request.body);
  } catch {
    return genericOk();
  }
  if (raw === null || !isWithinSubmissionBodyLimit(raw, declaredLength)) {
    return genericOk();
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return genericOk();
  }

  const parsed = ratingFollowupSubmissionSchema.safeParse(input);
  if (!parsed.success || (parsed.data.website ?? "") !== "") return genericOk();

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = createSubmissionFingerprint(env.SUBMISSION_FINGERPRINT_SECRET, {
    forwardedFor: forwarded,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    acceptLanguage: request.headers.get("accept-language") ?? "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAnonymousClient() as any;
  const { data, error } = await supabase.rpc("submit_rating_followup", {
    p_public_token: parsed.data.token,
    p_continuation_token: parsed.data.continuationToken,
    p_rating: parsed.data.rating ?? null,
    p_customer_name: parsed.data.customerName ?? null,
    p_customer_email: parsed.data.customerEmail ?? null,
    p_comment: parsed.data.comment ?? null,
    p_contact_requested: parsed.data.contactRequested ?? false,
    p_skip: parsed.data.skip ?? false,
    p_fingerprint_hash: fingerprint,
    p_user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  });

  if (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "22023") {
      return NextResponse.json({ ok: false, error: "Please add an email address if you want us to contact you." }, { status: 422 });
    }
    if (err.code === "P0001") {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unable to update feedback" }, { status: 503 });
  }

  if (data?.ok !== true) {
    return NextResponse.json({ ok: false, error: "Unable to update feedback" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    followUpStatus: data.follow_up_status,
    contactStatus: data.contact_status,
    identityStatus: data.identity_status,
    ratingValue: data.rating_value,
    ratingLabel: data.rating_label,
    ratingEmoji: data.rating_emoji,
  });
}

function genericOk() {
  return NextResponse.json({ ok: false });
}