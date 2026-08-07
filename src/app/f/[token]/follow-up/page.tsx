import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { isValidDistributionToken } from "@/lib/distribution/token-validator";
import FollowUpForm from "./follow-up-form";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export default async function FeedbackFollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ct?: string }>;
}) {
  const { token } = await params;
  const { ct } = await searchParams;

  if (!isValidDistributionToken(token) || !ct) {
    return <InactivePage />;
  }

  const supabase = sb(createSupabaseAnonymousClient());
  const { data } = await supabase.rpc("get_rating_followup_context", {
    p_public_token: token,
    p_continuation_token: ct,
  });

  if (!(data as Record<string, unknown> | null)?.ok) {
    return <InactivePage />;
  }

  const context = data as Record<string, unknown>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Follow-up</p>
        <h1 className="mt-3 text-xl font-bold text-foreground">Tell us a little more</h1>
        <p className="mt-1 text-sm text-muted">Your rating is already saved. You can add contact details, change the score, or skip this step.</p>

        <FollowUpForm
          token={token}
          continuationToken={ct}
          ratingValue={Number(context.rating_value ?? 3)}
          ratingLabel={String(context.rating_label ?? "Average")}
          ratingEmoji={String(context.rating_emoji ?? "😐")}
          organizationName={typeof context.organization_name_en === "string" ? context.organization_name_en : undefined}
          employeeName={typeof context.employee_name_en === "string" ? context.employee_name_en : undefined}
          locationName={typeof context.location_name_en === "string" ? context.location_name_en : undefined}
          initialName={typeof context.customer_name === "string" ? context.customer_name : undefined}
          initialEmail={typeof context.customer_email === "string" ? context.customer_email : undefined}
          initialComment={typeof context.comment === "string" ? context.comment : undefined}
        />
      </div>
    </main>
  );
}

function InactivePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-4 text-xl font-bold text-foreground">This follow-up link is no longer active</h1>
        <p className="mt-2 text-sm text-muted">The continuation link has expired or has already been used.</p>
      </div>
    </main>
  );
}