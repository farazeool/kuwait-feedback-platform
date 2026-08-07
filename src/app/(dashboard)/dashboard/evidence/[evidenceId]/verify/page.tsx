import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvidence, getVerificationHistory } from "@/features/evidence/server";
import { verifyEvidence } from "@/features/evidence/actions";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

const statusColors: Record<string, string> = {
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

export default async function VerifyEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ evidenceId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ evidenceId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getEvidence(evidenceId);
  const m = getMessages(detail.context.profile.locale as Locale);
  const verifications = detail.verifications;

  const canVerify = detail.context.profile.platformRole === "platform_admin" ||
    ["organization_owner", "organization_admin", "location_manager"].includes(detail.context.membership?.role ?? "");

  if (!canVerify) {
    return (
      <div className="grid gap-6 max-w-3xl">
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <p className="text-lg font-semibold text-foreground">Access denied</p>
          <p className="mt-2 text-sm text-muted">You do not have permission to verify evidence.</p>
          <Link href={`/dashboard/evidence/${evidenceId}`} className="mt-4 inline-block rounded-lg border border-border px-4 py-2 font-medium text-brand hover:underline">
            Back to evidence
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = detail.evidence.verification_status;
  const canSubmitVerification = currentStatus === "pending" || currentStatus === "more_evidence_required";

  return (
    <div className="grid gap-6 max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Evidence management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Verify evidence</h1>
          <p className="mt-1 text-sm text-muted">{detail.evidence.file_name}</p>
        </div>
        <Link href={`/dashboard/evidence/${evidenceId}`} className="rounded-lg border border-border px-4 py-2 font-medium">
          Back to evidence
        </Link>
      </header>

      {notice.verified ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Evidence verified.</p> : null}
      {notice.verification_failed ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Verification failed.</p> : null}
      {notice.error === "verification_validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please select a status and provide comments.</p> : null}

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Evidence details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">File name</dt>
            <dd className="mt-1 font-medium">{detail.evidence.file_name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">File type</dt>
            <dd className="mt-1 capitalize">{detail.evidence.file_type.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Entity type</dt>
            <dd className="mt-1 capitalize">{detail.evidence.entity_type.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Current verification status</dt>
            <dd className="mt-1"><StatusBadge status={currentStatus} /></dd>
          </div>
          {detail.evidence.description && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap">{detail.evidence.description}</dd>
            </div>
          )}
        </dl>
      </section>

      {canSubmitVerification ? (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Submit verification decision</h2>
          <form action={verifyEvidence} className="mt-4 grid gap-4">
            <input type="hidden" name="evidenceId" value={evidenceId} />
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Status</span>
              <select name="status" required className="rounded-lg border border-border px-3 py-2 text-sm">
                <option value="" disabled>Select a decision…</option>
                <option value="accepted">Accept</option>
                <option value="rejected">Reject</option>
                <option value="more_evidence_required">Request more evidence</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Comments (required)</span>
              <textarea name="comments" required className="rounded-lg border border-border px-3 py-2 text-sm min-h-24" placeholder="Explain your verification decision..." maxLength={2000} />
            </label>
            <div>
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">
                Submit verification
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="rounded-xl border border-border bg-surface-muted p-6 text-center">
          <p className="text-sm font-semibold text-foreground">This evidence has already been {currentStatus.replaceAll("_", " ")}.</p>
          <p className="mt-2 text-sm text-muted">Only pending or more-evidence-required evidence can be verified.</p>
        </div>
      )}

      {verifications.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Verification history</h2>
          <div className="mt-4 space-y-4">
            {verifications.map((v) => (
              <div key={v.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <StatusBadge status={v.status} />
                    <p className="mt-2 text-sm text-muted">By {v.verifier?.display_name ?? "Unknown"}</p>
                  </div>
                  <span className="text-sm text-muted">{formatKuwaitDateTime(v.verified_at)}</span>
                </div>
                {v.comments && <p className="mt-3 whitespace-pre-wrap text-sm">{v.comments}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}