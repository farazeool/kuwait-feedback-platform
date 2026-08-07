import { NextResponse, type NextRequest } from "next/server";

import { ratingSubmissionSchema } from "@/features/distribution/schema";
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

  const parsed = ratingSubmissionSchema.safeParse(input);
  // Honeypot check: website field must be empty string or undefined (backward compatible)
  if (!parsed.success || (parsed.data.website ?? "") !== "") return genericOk();

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = createSubmissionFingerprint(env.SUBMISSION_FINGERPRINT_SECRET, {
    forwardedFor: forwarded,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    acceptLanguage: request.headers.get("accept-language") ?? "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAnonymousClient() as any;
  const { data, error } = await supabase.rpc("record_rating", {
    p_public_token: parsed.data.token,
    p_rating: parsed.data.rating,
    p_nonce: parsed.data.nonce,
    p_fingerprint_hash: fingerprint,
    p_user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  });

  if (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "P0001") {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    // Database/RPC failure: return non-success without exposing internals
    return NextResponse.json(
      { ok: false, error: "Unable to record feedback" },
      { status: 503 }
    );
  }

  // Verify actual persistence occurred
  if (data?.recorded !== true) {
    // RPC succeeded but rating was not persisted (invalid/consumed nonce, expired token, etc.)
    return NextResponse.json(
      { ok: false, error: "Unable to record feedback" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    continuationToken: data.continuation_token,
    ratingValue: data.rating_value,
    ratingLabel: data.rating_label,
    ratingEmoji: data.rating_emoji,
  });
}

function genericOk() {
  // Return ok: false with HTTP 200 to prevent information leakage
  // while ensuring the client does not show a false Thank You screen.
  // Attackers cannot distinguish between success and security rejections.
  return NextResponse.json({ ok: false });
}
