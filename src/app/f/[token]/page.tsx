import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import RatingForm from "./rating-form";

export const runtime = "nodejs";

const TOKEN_RE = /^(?:[a-f0-9]{24,128}|[a-zA-Z0-9-]{24,128})$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export default async function FeedbackLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!TOKEN_RE.test(token)) {
    return <InactivePage />;
  }

  const supabase = sb(createSupabaseAnonymousClient());
  const { data } = await supabase.rpc("issue_rating_nonce", {
    p_public_token: token,
    p_fingerprint_hash: null,
  });

  const nonce = (data as Record<string, unknown> | null)?.nonce as string | undefined;
  const ratingStyle = (data as Record<string, unknown> | null)?.rating_style as string | undefined;

  if (!nonce) {
    return <InactivePage />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Feedback</p>
        <h1 className="mt-3 text-xl font-bold text-foreground">How was your experience?</h1>
        <p className="mt-1 text-sm text-muted">Your response is anonymous and takes one tap.</p>
        <RatingForm token={token} nonce={nonce} ratingStyle={ratingStyle ?? "emoji"} />
      </div>
    </main>
  );
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
