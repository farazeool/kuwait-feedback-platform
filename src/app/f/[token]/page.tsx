import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { isValidDistributionToken } from "@/lib/distribution/token-validator";
import { headers } from "next/headers";
import RatingForm from "./rating-form";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export default async function FeedbackLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r: ratingParam } = await searchParams;

  if (!isValidDistributionToken(token)) {
    return <InactivePage />;
  }

  const supabase = sb(createSupabaseAnonymousClient());
  const { data } = await supabase.rpc("issue_rating_nonce", {
    p_public_token: token,
    p_fingerprint_hash: null,
  });

  const nonce = (data as Record<string, unknown> | null)?.nonce as string | undefined;
  const organizationNameEn = (data as Record<string, unknown> | null)?.organization_name_en as string | undefined;
  const employeeNameEn = (data as Record<string, unknown> | null)?.employee_name_en as string | undefined;
  const locationNameEn = (data as Record<string, unknown> | null)?.location_name_en as string | undefined;

  if (!nonce) {
    return <InactivePage />;
  }

  // Record click tracking asynchronously after successful nonce issuance
  // Failure here must never block the rating form from loading
  recordClickAsync(token).catch(() => {
    // Silently fail - click tracking is secondary to rating form availability
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Feedback</p>
        <h1 className="mt-3 text-xl font-bold text-foreground">How was your experience?</h1>
        <p className="mt-1 text-sm text-muted">
          {employeeNameEn ? `For ${employeeNameEn}${locationNameEn ? ` at ${locationNameEn}` : ""}.` : "Your response is anonymous and takes one tap."}
        </p>
        <RatingForm
          token={token}
          nonce={nonce}
          initialRating={ratingParam}
          organizationName={organizationNameEn}
          employeeName={employeeNameEn}
          locationName={locationNameEn}
        />
      </div>
    </main>
  );
}

/**
 * Record distribution link click asynchronously.
 *
 * This function is called after successful nonce issuance to track
 * that a user opened the rating link. It runs in the background
 * and errors are caught to prevent blocking the rating form.
 */
async function recordClickAsync(token: string): Promise<void> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const userAgent = headersList.get("user-agent");
  const referer = headersList.get("referer");

  const supabase = sb(createSupabaseAnonymousClient());
  await supabase.rpc("record_distribution_click", {
    p_public_token: token,
    p_ip_address: forwardedFor?.split(",")[0]?.trim() ?? null,
    p_user_agent: userAgent ?? null,
    p_referer: referer ?? null,
  });
}

function InactivePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-4 text-xl font-bold text-foreground">This link is no longer active</h1>
        <p className="mt-2 text-sm text-muted">
          This feedback link has expired or been removed.
        </p>
      </div>
    </main>
  );
}
