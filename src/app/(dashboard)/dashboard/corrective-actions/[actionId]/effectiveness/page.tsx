import { notFound } from "next/navigation";
import { getCorrectiveAction } from "@/features/corrective-actions/server";
import { getEvidenceForEntity, getEffectivenessReviewsForAction, getFilterOptions } from "@/features/evidence/server";
import { submitEffectivenessReview } from "@/features/evidence/actions";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";
import Link from "next/link";

const resultColors: Record<string, string> = {
  effective: "bg-emerald-100 text-emerald-800",
  partially_effective: "bg-amber-100 text-amber-800",
  not_effective: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  more_evidence_required: "bg-purple-100 text-purple-800",
};

function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultColors[result] ?? "bg-gray-100 text-gray-800"}`}>
      {result.replaceAll("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default async function EffectivenessReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ actionId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ actionId }, notice] = await Promise.all([params, searchParams]);
  const { context, action } = await getCorrectiveAction(actionId);
  const m = getMessages(context.profile.locale as Locale);
  const filterOpts = await getFilterOptions();

  const canReview = context.profile.platformRole === "platform_admin" ||
    ["organization_owner", "organization_admin", "location_manager"].includes(context.membership?.role ?? "");

  if (!canReview) {
    notFound();
  }

  const evidence = await getEvidenceForEntity("corrective_action", actionId);
  const reviews = await getEffectivenessReviewsForAction(actionId);

  const pendingEvidence = evidence.filter((e) => e.verification_status === "pending" || e.verification_status === "more_evidence_required");
  const hasUnverified = pendingEvidence.length > 0;
  const latestReview = reviews.length > 0 ? reviews[0] : null;
  const hasExistingReview = latestReview !== null;

  return (
    <div className="grid gap-6 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Effectiveness review</h1>
          <p className="mt-1 text-sm text-muted">Corrective action #{action.id.slice(0, 8)} · {action.problem.slice(0, 80)}</p>
        </div>
        <Link href={`/dashboard/corrective-actions/${actionId}`} className="rounded-lg border border-border px-4 py-2 font-medium">
          Back to corrective action
        </Link>
      </header>

      {notice.effectiveness_reviewed ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Effectiveness review submitted.</p> : null}
      {notice.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}
      {notice.error === "missing_fields" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please fill in all required fields.</p> : null}
      {notice.error === "save_failed" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Failed to save effectiveness review.</p> : null}

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Action summary</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Status</dt>
            <dd className="mt-1"><StatusBadge status={action.status} /></dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Priority</dt>
            <dd className="mt-1 capitalize font-semibold">{action.priority}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Due date</dt>
            <dd className="mt-1">{formatKuwaitDate(action.due_date)}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-sm text-muted">Current effectiveness status</dt>
            <dd className="mt-1">{action.effectiveness_result ? <ResultBadge result={action.effectiveness_result} /> : <span className="text-sm text-muted">Not yet reviewed</span>}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Evidence ({evidence.length} items)</h2>
        {evidence.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No evidence attached to this corrective action.</p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {evidence.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-brand/10 px-2 py-1 text-xs font-medium text-brand capitalize">{e.file_type.replaceAll("_", " ")}</span>
                    <div>
                      <p className="font-medium">{e.file_name}</p>
                      <p className="text-xs text-muted">{e.uploader?.display_name ?? "—"} · {formatKuwaitDateTime(e.uploaded_at)}</p>
                    </div>
                  </div>
                  <StatusBadge status={e.verification_status} />
                </div>
              ))}
            </div>
            {hasUnverified && (
              <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-800">{pendingEvidence.length} piece(s) of evidence are still pending verification.</p>
                <p className="mt-1 text-sm text-amber-700">All evidence should be verified before conducting the effectiveness review.</p>
                <Link href={`/dashboard/corrective-actions/${actionId}/verify`} className="mt-3 inline-block text-sm text-brand hover:underline">
                  Go to verification page
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Submit effectiveness review</h2>
        <form action={submitEffectivenessReview} className="mt-4 grid gap-4">
          <input type="hidden" name="correctiveActionId" value={actionId} />

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Result</span>
            <select name="result" defaultValue={action.effectiveness_result ?? "effective"} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="effective">Effective - The action resolved the problem</option>
              <option value="partially_effective">Partially effective - The action partially resolved the problem</option>
              <option value="not_effective">Not effective - The action did not resolve the problem</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Review date</span>
            <input type="date" name="reviewDate" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-border px-3 py-2 text-sm" required />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Comments</span>
            <textarea name="comments" className="rounded-lg border border-border px-3 py-2 text-sm min-h-24" placeholder="Describe findings from the effectiveness review..." maxLength={3000} />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Follow-up required</span>
            <select name="followUpRequired" defaultValue="false" className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="false">No follow-up needed</option>
              <option value="true">Yes, follow-up required</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Follow-up notes</span>
            <textarea name="followUpNotes" className="rounded-lg border border-border px-3 py-2 text-sm min-h-24" placeholder="Details about required follow-up..." maxLength={2000} />
          </label>

          <div className="pt-4 border-t border-border">
            <button type="submit" className="rounded-lg bg-brand px-5 py-3 font-bold text-white">Submit effectiveness review</button>
          </div>
        </form>
      </section>

      {reviews.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Previous reviews ({reviews.length})</h2>
          <div className="mt-4 space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <ResultBadge result={r.result} />
                      <span className="text-sm text-muted">{formatKuwaitDate(r.review_date)}</span>
                    </div>
                    <p className="mt-1 text-sm">By {r.reviewer?.display_name ?? "Unknown"}</p>
                  </div>
                  {r.follow_up_required && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">Follow-up required</span>
                  )}
                </div>
                {r.comments && <p className="mt-3 whitespace-pre-wrap text-sm">{r.comments}</p>}
                {r.follow_up_notes && (
                  <div className="mt-3 rounded-lg bg-orange-50 p-3 border border-orange-100">
                    <p className="text-sm font-semibold text-orange-800">Follow-up notes</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{r.follow_up_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}