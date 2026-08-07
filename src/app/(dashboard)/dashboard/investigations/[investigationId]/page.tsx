import Link from "next/link";
import { updateInvestigationStatus, addComment, deleteInvestigation } from "@/features/investigations/actions";
import { getInvestigation, getInvestigationFilterOptions } from "@/features/investigations/server";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";

const controlClass = "rounded-lg border border-border px-3 py-2 text-sm";
const textareaClass = `${controlClass} min-h-24`;

const statusColors: Record<string, string | undefined> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-blue-100 text-blue-800",
  waiting_verification: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800",
};
const escalationColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-800",
  quality_manager: "bg-amber-100 text-amber-800",
  senior_management: "bg-orange-100 text-orange-800",
  platform_admin: "bg-red-100 text-red-800",
};
const statusOrder = ["draft", "active", "waiting_verification", "closed"] as const;

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>{status.replaceAll("_", " ")}</span>;
}

function EscalationBadge({ decision }: { decision: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${escalationColors[decision] ?? "bg-gray-100 text-gray-800"}`}>{decision.replaceAll("_", " ")}</span>;
}

export default async function InvestigationDetailPage({ params, searchParams }: { params: Promise<{ investigationId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ investigationId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getInvestigation(investigationId);
  const m = getMessages(detail.context.profile.locale as Locale);

  const canEdit = detail.context.profile.platformRole === "platform_admin" ||
    detail.investigation.investigator_id === detail.context.user.id ||
    ["organization_owner", "organization_admin", "quality_manager"].includes(detail.context.membership?.role ?? "");

  const isAdmin = detail.context.profile.platformRole === "platform_admin";

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Investigation #{detail.investigation.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-muted">
            Created by {detail.investigation.created_by_profile?.display_name ?? "Unknown"} · {formatKuwaitDateTime(detail.investigation.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <form action={deleteInvestigation}>
              <input type="hidden" name="investigationId" value={investigationId} />
              <button className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100">Delete</button>
            </form>
          )}
        </div>
      </header>

      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Investigation created.</p> : null}
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Investigation updated.</p> : null}
      {notice.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}
      {notice.commented ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Comment added.</p> : null}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted">Status</p>
          <p className="mt-2"><StatusBadge status={detail.investigation.status} /></p>
        </div>
        <div>
          <p className="text-sm text-muted">Escalation</p>
          <p className="mt-2"><EscalationBadge decision={detail.investigation.escalation_decision} /></p>
        </div>
        <div>
          <p className="text-sm text-muted">Investigated</p>
          <p className="mt-2">{formatKuwaitDate(detail.investigation.investigated_at)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Investigator</p>
          <p className="mt-2">{detail.investigation.investigator?.display_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Branch</p>
          <p className="mt-2">{detail.investigation.branch?.name_en ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Department</p>
          <p className="mt-2">{detail.investigation.department?.name_en ?? "—"}</p>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Title</h2>
        <p className="whitespace-pre-wrap">{detail.investigation.title}</p>
      </section>

      {detail.investigation.description && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Description</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.description}</p>
        </section>
      )}

      {detail.investigation.evidence_reviewed && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Evidence reviewed</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.evidence_reviewed}</p>
        </section>
      )}

      {detail.investigation.root_cause && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Root cause</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.root_cause}</p>
        </section>
      )}

      {detail.investigation.findings && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Findings</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.findings}</p>
        </section>
      )}

      {detail.investigation.recommendation && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Recommendation</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.recommendation}</p>
        </section>
      )}

      {detail.investigation.repeated_complaints && (
        <section className="grid gap-3 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Repeated complaints</h2>
          {detail.investigation.repeated_complaints_notes && <p className="whitespace-pre-wrap">{detail.investigation.repeated_complaints_notes}</p>}
        </section>
      )}

      {detail.investigation.internal_notes && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Internal notes</h2>
          <p className="whitespace-pre-wrap">{detail.investigation.internal_notes}</p>
        </section>
      )}

      {detail.investigation.controlled_record_references.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Controlled record references</h2>
          <ul className="list-inside list-disc">
            {detail.investigation.controlled_record_references.map((ref, i) => (
              <li key={i} className="text-sm">{ref}</li>
            ))}
          </ul>
        </section>
      )}

      {detail.relatedResponses.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Related responses</h2>
          <div className="mt-3 grid gap-2">
            {detail.relatedResponses.map((resp) => (
              <Link key={resp.id} href={`/dashboard/responses/${resp.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-muted">
                <div>
                  <span className="text-sm text-muted">{(resp as { survey?: { title_en?: string } })?.survey?.title_en ?? resp.id.slice(0, 8)}</span>
                  <span className="ml-3 text-sm text-muted">{(resp as { location?: { name_en?: string } })?.location?.name_en ?? "—"}</span>
                </div>
                <span className="text-sm">{resp.overall_rating ?? "—"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {detail.relatedAlerts.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Related alerts</h2>
          <div className="mt-3 grid gap-2">
            {detail.relatedAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{alert.alert_type}</span>
                <span className="text-sm text-muted">{alert.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.relatedCorrectiveActions.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Related corrective actions</h2>
          <div className="mt-3 grid gap-2">
            {detail.relatedCorrectiveActions.map((ca) => (
              <Link key={ca.id} href={`/dashboard/corrective-actions/${ca.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-muted">
                <span className="text-sm font-medium">{ca.problem}</span>
                <span className="text-sm text-muted">{ca.status.replaceAll("_", " ")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Timeline & status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusOrder.map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 text-sm font-medium ${detail.investigation.status === s ? (statusColors[s] ?? "bg-surface-muted") : "bg-surface-muted text-muted"}`}>{s.replaceAll("_", " ")}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          Created {formatKuwaitDateTime(detail.investigation.created_at)} ·
          {detail.investigation.updated_at && `Updated ${formatKuwaitDateTime(detail.investigation.updated_at)}`}
        </p>
        {detail.investigation.closed_at && <p className="mt-1 text-sm text-green-700">Closed: {formatKuwaitDate(detail.investigation.closed_at)}</p>}
      </section>

      {detail.statusHistory.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Status history</h2>
          <div className="mt-3 grid gap-2">
            {detail.statusHistory.map((h) => (
              <div key={h.id} className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[h.previous_status ?? ""] ?? "bg-gray-100 text-gray-800"}`}>{h.previous_status ?? "—"}</span>
                    <span className="text-muted">→</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[h.new_status] ?? "bg-gray-100 text-gray-800"}`}>{h.new_status}</span>
                  </div>
                  <div className="text-xs text-muted text-right">
                    {formatKuwaitDateTime(h.changed_at)} by {h.changed_by_profile?.display_name ?? "—"}
                    {h.change_reason && <p className="mt-1 text-muted">{h.change_reason}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {detail.attachments.length > 0 && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Attachments</h2>
          <div className="mt-3 grid gap-2">
            {detail.attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-brand/10 px-2 py-1 text-xs font-medium text-brand capitalize">{a.file_type}</span>
                  <span className="font-medium">{a.file_name}</span>
                  {a.description && <span className="text-sm text-muted">{a.description}</span>}
                </div>
                <div className="text-sm text-muted">{a.uploaded_by_profile?.display_name} · {formatKuwaitDateTime(a.uploaded_at)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Comments</h2>
        <div className="mt-3 grid gap-3">
          {detail.comments.map((c) => (
            <article key={c.id} className="rounded-xl bg-background p-4">
              <p className="whitespace-pre-wrap">{c.comment}</p>
              <p className="mt-2 text-xs text-muted">{c.author?.display_name} · {formatKuwaitDateTime(c.created_at)}</p>
            </article>
          ))}
        </div>
        {detail.comments.length === 0 && <p className="mt-3 text-sm text-muted">No comments yet.</p>}

        <form action={addComment} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="investigationId" value={investigationId} />
          <textarea name="comment" className={textareaClass} placeholder="Add a comment..." required />
          <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white self-end">Add</button>
        </form>
      </section>

      {canEdit && (
        <form action={updateInvestigationStatus} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
          <input type="hidden" name="investigationId" value={investigationId} />
          <label className="grid gap-2 font-semibold">
            Update status
            <select name="status" defaultValue={detail.investigation.status} className={controlClass}>
              {statusOrder.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="grid gap-2 font-semibold md:col-span-2">
            Reason for status change
            <textarea name="reason" className={textareaClass} placeholder="Required for audit trail" />
          </label>
          <button className="justify-self-start rounded-lg bg-brand px-5 py-3 font-bold text-white">Update status</button>
        </form>
      )}
    </div>
  );
}