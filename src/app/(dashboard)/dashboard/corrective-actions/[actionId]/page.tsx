import { updateCorrectiveActionStatus, addCorrectiveActionComment, deleteCorrectiveAction } from "@/features/corrective-actions/actions";
import { getCorrectiveAction } from "@/features/corrective-actions/server";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";

const controlClass = "rounded-lg border border-border px-3 py-2 text-sm";
const textareaClass = `${controlClass} min-h-24`;
const statusColors: Record<string, string | undefined> = {
  draft: "bg-gray-100 text-gray-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  pending_verification: "bg-purple-100 text-purple-800",
  verified: "bg-emerald-100 text-emerald-800",
  effectiveness_review: "bg-teal-100 text-teal-800",
  closed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};
const priorityColors: Record<string, string> = {
  low: "text-gray-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};
const statusOrder = ["draft", "open", "in_progress", "pending_verification", "verified", "effectiveness_review", "closed", "rejected"] as const;

type Status = typeof statusOrder[number];

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>{status.replaceAll("_", " ")}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`font-semibold capitalize ${priorityColors[priority] ?? ""}`}>{priority}</span>;
}

export default async function CorrectiveActionDetailPage({ params, searchParams }: { params: Promise<{ actionId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ actionId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getCorrectiveAction(actionId);

  const canEdit = detail.context.profile.platformRole === "platform_admin" ||
    detail.action.assigned_owner_id === detail.context.user.id ||
    ["organization_owner", "organization_admin", "quality_manager"].includes(detail.context.membership?.role ?? "");

  const isAdmin = detail.context.profile.platformRole === "platform_admin";

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Corrective action #{detail.action.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-muted">
            Created by {detail.action.created_by_profile?.display_name ?? "Unknown"} · {formatKuwaitDateTime(detail.action.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <form action={deleteCorrectiveAction}><input type="hidden" name="actionId" value={actionId} /><button className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100">Delete</button></form>}
        </div>
      </header>

      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Corrective action created.</p> : null}
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Corrective action updated.</p> : null}
      {notice.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}
      {notice.commented ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Comment added.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Corrective action deleted.</p> : null}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-4">
        <div>
          <p className="text-sm text-muted">Priority</p>
          <p className="mt-2"><PriorityBadge priority={detail.action.priority} /></p>
        </div>
        <div>
          <p className="text-sm text-muted">Status</p>
          <p className="mt-2"><StatusBadge status={detail.action.status} /></p>
        </div>
        <div>
          <p className="text-sm text-muted">Due date</p>
          <p className="mt-2">{formatKuwaitDate(detail.action.due_date)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Target completion</p>
          <p className="mt-2">{formatKuwaitDate(detail.action.target_completion_date)}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm text-muted">Assigned to</p>
          <p className="mt-2">{detail.action.assigned_owner?.display_name ?? "—"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-sm text-muted">Branch / Department</p>
          <p className="mt-2">{detail.action.branch?.name_en ?? "—"} / {detail.action.department?.name_en ?? "—"}</p>
        </div>
        <div className="sm:col-span-4">
          <p className="text-sm text-muted">Controlled record ref</p>
          <p className="mt-2">{detail.action.controlled_record_reference ?? "—"}</p>
        </div>
      </section>

      {detail.sourceResponse && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Source response</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div><p className="text-sm text-muted">Rating</p><p className="mt-1">{detail.sourceResponse.overall_rating ?? "—"}</p></div>
            <div><p className="text-sm text-muted">Workflow</p><p className="mt-1">{detail.sourceResponse.workflow_status.replaceAll("_", " ")}</p></div>
            <div><p className="text-sm text-muted">Channel</p><p className="mt-1">{detail.sourceResponse.channel}</p></div>
            <div><p className="text-sm text-muted">Location</p><p className="mt-1">{(detail.sourceResponse as { location?: { name_en?: string } })?.location?.name_en ?? "—"}</p></div>
            <div className="sm:col-span-4"><p className="text-sm text-muted">Survey</p><p className="mt-1">{(detail.sourceResponse as { survey?: { title_en?: string } })?.survey?.title_en ?? "—"}</p></div>
          </div>
        </section>
      )}

      {detail.relatedAlert && (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Related alert</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div><p className="text-sm text-muted">Type</p><p className="mt-1">{detail.relatedAlert.alert_type}</p></div>
            <div><p className="text-sm text-muted">Status</p><p className="mt-1">{detail.relatedAlert.status}</p></div>
            <div><p className="text-sm text-muted">Rating</p><p className="mt-1">{detail.relatedAlert.rating_value ?? "—"}</p></div>
            <div><p className="text-sm text-muted">Threshold</p><p className="mt-1">{detail.relatedAlert.threshold_value ?? "—"}</p></div>
            <div className="sm:col-span-4"><p className="text-sm text-muted">Message</p><p className="mt-1">{detail.relatedAlert.message}</p></div>
          </div>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Problem</h2>
        <p className="mt-3 whitespace-pre-wrap">{detail.action.problem}</p>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Root cause</h2>
        <p className="mt-3 whitespace-pre-wrap">{detail.action.root_cause}</p>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Action description</h2>
        <p className="mt-3 whitespace-pre-wrap">{detail.action.action_description}</p>
      </section>

      {detail.action.internal_notes && (
        <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Internal notes</h2>
          <p className="mt-3 whitespace-pre-wrap">{detail.action.internal_notes}</p>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Timeline & status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusOrder.map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 text-sm font-medium ${detail.action.status === s ? (statusColors[s] ?? "bg-surface-muted") : "bg-surface-muted text-muted"}`}>{s.replaceAll("_", " ")}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          Created {formatKuwaitDateTime(detail.action.created_at)} ·
          {detail.action.updated_at && `Updated ${formatKuwaitDateTime(detail.action.updated_at)}`}
        </p>
        {detail.action.due_date && (
          <p className="mt-1 text-sm text-muted">Due: {formatKuwaitDate(detail.action.due_date)} · Target: {formatKuwaitDate(detail.action.target_completion_date)}</p>
        )}
        {detail.action.completion_date && <p className="mt-1 text-sm text-emerald-700">Completed: {formatKuwaitDate(detail.action.completion_date)}</p>}
        {detail.action.closure_date && <p className="mt-1 text-sm text-green-700">Closed: {formatKuwaitDate(detail.action.closure_date)}</p>}
        {detail.action.verified_at && <p className="mt-1 text-sm text-blue-700">Verified: {formatKuwaitDateTime(detail.action.verified_at)} by {detail.action.verified_by_profile?.display_name ?? "—"}</p>}
        {detail.action.effectiveness_review_date && <p className="mt-1 text-sm text-teal-700">Effectiveness reviewed: {formatKuwaitDate(detail.action.effectiveness_review_date)}</p>}
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

        <form action={addCorrectiveActionComment} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input type="hidden" name="actionId" value={actionId} />
          <textarea name="comment" className={textareaClass} placeholder="Add a comment..." required />
          <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white self-end">Add</button>
        </form>
      </section>

      {canEdit && (
        <form action={updateCorrectiveActionStatus} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
          <input type="hidden" name="actionId" value={actionId} />
          <label className="grid gap-2 font-semibold">
            Update status
            <select name="status" defaultValue={detail.action.status} className={controlClass}>
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