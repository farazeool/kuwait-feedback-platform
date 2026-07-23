import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvidence, getEvidenceForEntity, getFilterOptions } from "@/features/evidence/server";
import { getCorrectiveAction } from "@/features/corrective-actions/server";
import { getInvestigation } from "@/features/investigations/server";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";
import { verifyEvidence, deleteEvidence } from "@/features/evidence/actions";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  more_evidence_required: "bg-purple-100 text-purple-800",
};

const fileTypeColors: Record<string, string> = {
  photo: "bg-blue-100 text-blue-800",
  pdf: "bg-red-100 text-red-800",
  checklist: "bg-green-100 text-green-800",
  training_record: "bg-indigo-100 text-indigo-800",
  maintenance_record: "bg-orange-100 text-orange-800",
  supplier_document: "bg-teal-100 text-teal-800",
  other: "bg-gray-100 text-gray-800",
};

const entityTypeColors: Record<string, string> = {
  corrective_action: "bg-blue-100 text-blue-800",
  investigation: "bg-purple-100 text-purple-800",
  response: "bg-green-100 text-green-800",
  alert: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FileTypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fileTypeColors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entityTypeColors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

export default async function EvidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evidenceId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ evidenceId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getEvidence(evidenceId);
  const m = getMessages(detail.context.profile.locale as Locale);
  const filterOpts = await getFilterOptions();

  const canEdit = detail.context.profile.platformRole === "platform_admin" ||
    detail.evidence.uploaded_by === detail.context.user.id ||
    ["organization_owner", "organization_admin", "location_manager"].includes(detail.context.membership?.role ?? "");

  const canVerify = detail.context.profile.platformRole === "platform_admin" ||
    ["organization_owner", "organization_admin", "location_manager"].includes(detail.context.membership?.role ?? "");

  const isPlatformAdmin = detail.context.profile.platformRole === "platform_admin";

  let entityLink = null;
  let entityDetails = null;

  if (detail.evidence.entity_type === "corrective_action") {
    entityLink = `/dashboard/corrective-actions/${detail.evidence.entity_id}`;
    const { action } = await getCorrectiveAction(detail.evidence.entity_id);
    entityDetails = (
      <div className="grid gap-2 sm:grid-cols-2">
        <div><p className="text-sm text-muted">Problem</p><p className="mt-1 line-clamp-2">{action.problem}</p></div>
        <div><p className="text-sm text-muted">Status</p><p className="mt-1"><StatusBadge status={action.status} /></p></div>
        <div><p className="text-sm text-muted">Priority</p><p className="mt-1 capitalize">{action.priority}</p></div>
        <div><p className="text-sm text-muted">Assigned to</p><p className="mt-1">{action.assigned_owner?.display_name ?? "—"}</p></div>
      </div>
    );
  } else if (detail.evidence.entity_type === "investigation") {
    entityLink = `/dashboard/investigations/${detail.evidence.entity_id}`;
    const { investigation } = await getInvestigation(detail.evidence.entity_id);
    entityDetails = (
      <div className="grid gap-2 sm:grid-cols-2">
        <div><p className="text-sm text-muted">Title</p><p className="mt-1">{investigation.title}</p></div>
        <div><p className="text-sm text-muted">Status</p><p className="mt-1">{investigation.status}</p></div>
        <div><p className="text-sm text-muted">Investigator</p><p className="mt-1">{investigation.investigator_id}</p></div>
      </div>
    );
  } else if (detail.evidence.entity_type === "alert") {
    entityLink = `/dashboard/alerts/${detail.evidence.entity_id}`;
    entityDetails = (
      <div className="grid gap-2 sm:grid-cols-2">
        <div><p className="text-sm text-muted">Alert type</p><p className="mt-1">{detail.entityLabel}</p></div>
      </div>
    );
  } else if (detail.evidence.entity_type === "response") {
    entityLink = `/dashboard/responses/${detail.evidence.entity_id}`;
    entityDetails = (
      <div><p className="text-sm text-muted">Response ID</p><p className="mt-1">{detail.evidence.entity_id.slice(0, 8)}</p></div>
    );
  }

  const relatedEvidence = await getEvidenceForEntity(detail.evidence.entity_type, detail.evidence.entity_id);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Evidence management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{detail.evidence.file_name}</h1>
          <p className="mt-1 text-sm text-muted">
            Uploaded by {detail.evidence.uploader?.display_name ?? "Unknown"} · {formatKuwaitDateTime(detail.evidence.uploaded_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Link className="rounded-lg border border-border px-4 py-2 font-medium" href={`/dashboard/evidence/${evidenceId}/edit`}>Edit</Link>}
          {isPlatformAdmin && (
            <form action={deleteEvidence}>
              <input type="hidden" name="evidenceId" value={evidenceId} />
              <button className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100">Delete</button>
            </form>
          )}
        </div>
      </header>

      {notice.verified ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Evidence verified.</p> : null}
      {notice.verification_failed ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Verification failed.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Evidence deleted.</p> : null}
      {notice.more_evidence_requested ? <p className="rounded-xl bg-purple-50 p-4 text-purple-800">More evidence requested.</p> : null}

      {/* Main info card */}
      <section className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="text-sm text-muted">File name</p>
          <p className="mt-2 font-medium">{detail.evidence.file_name}</p>
        </div>
        <div>
          <p className="text-sm text-muted">File type</p>
          <p className="mt-2"><FileTypeBadge type={detail.evidence.file_type} /></p>
        </div>
        <div>
          <p className="text-sm text-muted">Entity type</p>
          <p className="mt-2"><EntityTypeBadge type={detail.evidence.entity_type} /></p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm text-muted">Entity</p>
          {entityLink ? (
            <Link className="mt-1 font-medium text-brand hover:underline" href={entityLink}>
              {detail.entityLabel}
            </Link>
          ) : (
            <p className="mt-1">{detail.entityLabel}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm text-muted">Storage path</p>
          <p className="mt-1 text-xs font-mono text-muted">{detail.evidence.storage_path}</p>
        </div>
        <div className="sm:col-span-4">
          <p className="text-sm text-muted">Description</p>
          <p className="mt-2 whitespace-pre-wrap">{detail.evidence.description ?? "—"}</p>
        </div>

        {entityDetails && (
          <div className="sm:col-span-4 pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground">Related entity details</p>
            {entityDetails}
          </div>
        )}

        <div className="sm:col-span-2">
          <p className="text-sm text-muted">Verification status</p>
          <p className="mt-2"><StatusBadge status={detail.evidence.verification_status} /></p>
        </div>
        {detail.evidence.verified_by && detail.evidence.verified_at && (
          <div className="sm:col-span-2">
            <p className="text-sm text-muted">Verified by</p>
            <p className="mt-1">{detail.evidence.verifier?.display_name ?? "—"}</p>
            <p className="text-sm text-muted">{formatKuwaitDateTime(detail.evidence.verified_at)}</p>
          </div>
        )}
        {detail.evidence.verification_comments && (
          <div className="sm:col-span-4">
            <p className="text-sm text-muted">Verification comments</p>
            <p className="mt-2 whitespace-pre-wrap">{detail.evidence.verification_comments}</p>
          </div>
        )}
      </section>

      {/* Verification workflow - only show for verifiers if not yet verified or more evidence needed */}
      {canVerify && (detail.evidence.verification_status === "pending" || detail.evidence.verification_status === "more_evidence_required") && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Verify evidence</h2>
          <form action={verifyEvidence} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="evidenceId" value={evidenceId} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">Verification decision</label>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value="accepted" required />
                  <span className="rounded-full border border-emerald-400 bg-emerald-50 px-4 py-2 text-emerald-800 font-medium">Accept</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value="rejected" />
                  <span className="rounded-full border border-red-400 bg-red-50 px-4 py-2 text-red-800 font-medium">Reject</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value="more_evidence_required" />
                  <span className="rounded-full border border-purple-400 bg-purple-50 px-4 py-2 text-purple-800 font-medium">More evidence required</span>
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">Comments (required)</label>
              <textarea required name="comments" className="mt-1 rounded-lg border border-border px-3 py-2 text-sm min-h-24 w-full" placeholder="Explain your verification decision..." maxLength={2000} />
            </div>
            <div className="sm:col-span-2 pt-4 border-t border-border">
              <button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">Submit verification</button>
            </div>
          </form>
        </section>
      )}

      {/* Verification history */}
      {detail.verifications.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Verification history</h2>
          <div className="mt-4 space-y-4">
            {detail.verifications.map((v) => (
              <div key={v.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={v.status} />
                      <span className="text-sm text-muted">{formatKuwaitDateTime(v.verified_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">By {v.verifier?.display_name ?? "Unknown"}</p>
                  </div>
                </div>
                {v.comments && <p className="mt-3 whitespace-pre-wrap text-sm">{v.comments}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related evidence for same entity */}
      {relatedEvidence.length > 1 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Related evidence</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-start">File name</th>
                  <th className="px-4 py-2.5 text-start">Type</th>
                  <th className="px-4 py-2.5 text-start">Verification</th>
                  <th className="px-4 py-2.5 text-start">Uploaded by</th>
                  <th className="px-4 py-2.5 text-start">Date</th>
                </tr>
              </thead>
              <tbody>
                {relatedEvidence
                  .filter((e) => e.id !== detail.evidence.id)
                  .map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <Link className="font-medium text-brand hover:underline" href={`/dashboard/evidence/${e.id}`}>
                          {e.file_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5"><FileTypeBadge type={e.file_type} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={e.verification_status} /></td>
                      <td className="px-4 py-2.5">{e.uploader?.display_name ?? "—"}</td>
                      <td className="px-4 py-2.5">{formatKuwaitDateTime(e.uploaded_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}