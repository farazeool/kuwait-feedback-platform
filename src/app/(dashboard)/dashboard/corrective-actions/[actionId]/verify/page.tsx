import Link from "next/link";
import { notFound } from "next/navigation";
import { getCorrectiveAction } from "@/features/corrective-actions/server";
import { getEvidenceForEntity } from "@/features/evidence/server";
import { verifyEvidence } from "@/features/evidence/actions";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  pending_verification: "bg-purple-100 text-purple-800",
  verified: "bg-emerald-100 text-emerald-800",
  effectiveness_review: "bg-teal-100 text-teal-800",
  closed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const verificationStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  more_evidence_required: "bg-purple-100 text-purple-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function VerificationStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${verificationStatusColors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FileTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    photo: "bg-green-100 text-green-800",
    pdf: "bg-red-100 text-red-800",
    checklist: "bg-blue-100 text-blue-800",
    training_record: "bg-purple-100 text-purple-800",
    maintenance_record: "bg-orange-100 text-orange-800",
    supplier_document: "bg-indigo-100 text-indigo-800",
    other: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

export default async function CorrectiveActionVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ actionId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ actionId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getCorrectiveAction(actionId);
  const m = getMessages(detail.context.profile.locale as Locale);

  const evidence = await getEvidenceForEntity("corrective_action", actionId);

  const canVerify = detail.context.profile.platformRole === "platform_admin" ||
    ["organization_owner", "organization_admin", "location_manager"].includes(detail.context.membership?.role ?? "");

  if (!canVerify) {
    return (
      <div className="grid gap-6 max-w-3xl">
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <p className="text-lg font-semibold text-foreground">Access denied</p>
          <p className="mt-2 text-sm text-muted">You do not have permission to verify evidence for this corrective action.</p>
          <Link href={`/dashboard/corrective-actions/${actionId}`} className="mt-4 inline-block rounded-lg border border-border px-4 py-2 font-medium text-brand hover:underline">
            Back to corrective action
          </Link>
        </div>
      </div>
    );
  }

  const pendingEvidence = evidence.filter((e) => e.verification_status === "pending" || e.verification_status === "more_evidence_required");
  const allVerified = evidence.length > 0 && pendingEvidence.length === 0;

  return (
    <div className="grid gap-6 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Verify evidence &mdash; {detail.action.problem.slice(0, 60)}</h1>
          <p className="mt-1 text-sm text-muted">Corrective action #{actionId.slice(0, 8)}</p>
        </div>
        <Link className="rounded-lg border border-border px-4 py-2 font-medium" href={`/dashboard/corrective-actions/${actionId}`}>
          Back to action
        </Link>
      </header>

      {notice.verified ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Evidence verified.</p> : null}
      {notice.verification_failed ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Verification failed.</p> : null}
      {notice.more_evidence_requested ? <p className="rounded-xl bg-purple-50 p-4 text-purple-800">More evidence requested.</p> : null}

      {/* Action summary */}
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Action summary</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">Status</dt>
            <dd className="mt-1"><StatusBadge status={detail.action.status} /></dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Priority</dt>
            <dd className="mt-1 capitalize font-semibold">{detail.action.priority}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Due date</dt>
            <dd className="mt-1">{formatKuwaitDate(detail.action.due_date)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Assigned to</dt>
            <dd className="mt-1">{detail.action.assigned_owner?.display_name ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {/* Evidence table */}
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Evidence ({evidence.length} items)</h2>
        {evidence.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No evidence attached to this corrective action.</p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-start">File</th>
                    <th className="px-4 py-2.5 text-start">Type</th>
                    <th className="px-4 py-2.5 text-start">Verification</th>
                    <th className="px-4 py-2.5 text-start">Uploaded by</th>
                    <th className="px-4 py-2.5 text-start">Date</th>
                    <th className="px-4 py-2.5 text-start">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <Link className="font-medium text-brand hover:underline" href={`/dashboard/evidence/${e.id}`}>
                          {e.file_name}
                        </Link>
                        {e.description && <p className="mt-1 text-xs text-muted truncate max-w-xs">{e.description}</p>}
                      </td>
                      <td className="px-4 py-2.5"><FileTypeBadge type={e.file_type} /></td>
                      <td className="px-4 py-2.5">
                        <VerificationStatusBadge status={e.verification_status} />
                        {e.verified_by && e.verified_at && (
                          <p className="mt-1 text-xs text-muted">By {e.verifier?.display_name ?? "—"} on {formatKuwaitDateTime(e.verified_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{e.uploader?.display_name ?? "—"}</td>
                      <td className="px-4 py-2.5">{formatKuwaitDateTime(e.uploaded_at)}</td>
                      <td className="px-4 py-2.5">
                        {(e.verification_status === "pending" || e.verification_status === "more_evidence_required") && (
                          <Link className="text-sm text-brand hover:underline" href={`/dashboard/evidence/${e.id}?returnTo=/dashboard/corrective-actions/${actionId}/verify`}>
                            Verify
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pendingEvidence.length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-semibold text-amber-800">{pendingEvidence.length} piece(s) of evidence need verification.</p>
                <p className="mt-1 text-sm text-amber-700">All evidence must be verified before proceeding to effectiveness review.</p>
              </div>
            )}

            {allVerified && (
              <div className="mt-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="font-semibold text-emerald-800">All evidence has been verified.</p>
                <p className="mt-1 text-sm text-emerald-700">You can now proceed to the effectiveness review.</p>
                <Link href={`/dashboard/corrective-actions/${actionId}/effectiveness`} className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
                  Proceed to effectiveness review
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* Quick verification from this page */}
      {pendingEvidence.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Quick verification</h2>
          <p className="mt-2 text-sm text-muted">Verify multiple pieces of evidence directly from this page.</p>
          <div className="mt-6 space-y-4">
            {pendingEvidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium">{e.file_name}</p>
                    <p className="text-sm text-muted">{e.file_type.replaceAll("_", " ")} · {e.description?.slice(0, 100) ?? "No description"}</p>
                  </div>
                  <form action={verifyEvidence} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="evidenceId" value={e.id} />
                    <input type="hidden" name="returnTo" value={`/dashboard/corrective-actions/${actionId}/verify`} />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="status" value="accepted" required />
                        <span className="text-xs font-medium text-emerald-700">Accept</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="status" value="rejected" />
                        <span className="text-xs font-medium text-red-700">Reject</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="status" value="more_evidence_required" />
                        <span className="text-xs font-medium text-purple-700">More evidence</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      name="comments"
                      placeholder="Comments (required)"
                      className="rounded-lg border border-border px-3 py-2 text-sm min-w-[200px]"
                      required
                      maxLength={2000}
                    />
                    <button type="submit" className="rounded-lg bg-brand px-3 py-2 font-medium text-white text-sm">
                      Submit
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}