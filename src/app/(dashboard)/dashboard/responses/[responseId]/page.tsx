import { updateResponseWorkflow } from "@/features/responses/actions";
import { getResponseDetail } from "@/features/responses/server";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function ResponseDetailPage({ params, searchParams }: { params: Promise<{ responseId: string }>; searchParams: Promise<{ updated?: string; error?: string }> }) {
  const [{ responseId }, notice] = await Promise.all([params, searchParams]);
  const detail = await getResponseDetail(responseId);
  const controlledRecord = detail.response.controlled_record_type ? {
    type: detail.response.controlled_record_type,
    reference: detail.response.controlled_record_reference,
    status: detail.response.controlled_record_status,
    openedBy: detail.response.controlled_record_opened_by,
    outcome: detail.response.controlled_record_outcome_summary,
  } : null;
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Anonymous response</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{detail.survey?.title_en}</h1>
        <p className="mt-2 text-muted">{detail.organization?.name_en} · {detail.location?.name_en} · {formatKuwaitDateTime(detail.response.submitted_at)}</p>
      </header>

      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Response workflow updated and audited.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">The workflow update was rejected.</p> : null}

      <section className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-4">
        <div>
          <p className="text-sm text-muted">Overall rating</p>
          <p className="mt-2 text-2xl font-bold">{detail.response.overall_rating ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Locale</p>
          <p className="mt-2 font-bold">{detail.response.locale.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Workflow</p>
          <p className="mt-2 font-bold">{({monitor_only: "No action needed", branch_followup: "Needs follow-up", controlled_investigation: "Under investigation", immediate_escalation: "Urgent escalation"})[detail.response.workflow_status] ?? detail.response.workflow_status}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Alert</p>
          <p className="mt-2 font-bold">{detail.alerts[0] ? `${detail.alerts[0].alert_type} · ${detail.alerts[0].status}` : "None"}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Channel</p>
          <p className="mt-2 font-bold">{detail.response.channel}</p>
        </div>
        {detail.department ? (
          <div>
            <p className="text-sm text-muted">Department</p>
            <p className="mt-2 font-bold">{detail.department.name_en}</p>
          </div>
        ) : null}
        {detail.touchpoint ? (
          <div>
            <p className="text-sm text-muted">Touchpoint</p>
            <p className="mt-2 font-bold">{detail.touchpoint.name_en}</p>
          </div>
        ) : null}
        <div className="sm:col-span-4">
          <p className="text-sm text-muted">Internal tags</p>
          <p className="mt-1">{detail.response.internal_tags.join(", ") || "None"}</p>
        </div>
      </section>

      {detail.concerns.length > 0 ? (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Concerns</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.concerns.map((concern) => (
              <span key={concern.slug} className={`rounded-full px-3 py-1 text-sm font-medium ${concern.isPrimary ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                {concern.nameEn} <span dir="rtl" lang="ar">· {concern.nameAr}</span>
                {concern.isPrimary ? " (primary)" : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {controlledRecord ? (
        <section className="rounded-xl border border-border bg-white p-6">
          <h2 className="text-base font-semibold text-foreground">Controlled record</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Type</dt>
              <dd className="font-bold">{controlledRecord.type}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Reference</dt>
              <dd className="font-bold">{controlledRecord.reference}</dd>
            </div>
            {controlledRecord.status ? (
              <div>
                <dt className="text-sm text-muted">Status</dt>
                <dd className="font-bold">{controlledRecord.status}</dd>
              </div>
            ) : null}
            {controlledRecord.openedBy ? (
              <div>
                <dt className="text-sm text-muted">Opened by</dt>
                <dd className="font-bold">{controlledRecord.openedBy}</dd>
              </div>
            ) : null}
            {controlledRecord.outcome ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Outcome summary</dt>
                <dd className="mt-1 whitespace-pre-wrap">{controlledRecord.outcome}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="grid gap-4">
        {detail.answers.map((item) => (
          <article key={item.question.id} className="rounded-xl border border-border bg-white p-5">
            <h2 className="font-bold">{item.question.prompt_en}</h2>
            <p className="mt-1 text-sm text-muted" dir="rtl">{item.question.prompt_ar}</p>
            <div className="mt-4 whitespace-pre-wrap break-words text-foreground">
              {(item.rating ?? item.text ?? item.choices.map((choice) => choice?.label_en).join(", ")) || "No answer"}
            </div>
          </article>
        ))}
      </section>

      {detail.canManage ? (
        <form action={updateResponseWorkflow} className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-2">
          <input type="hidden" name="responseId" value={responseId} />
          <h2 className="text-base font-semibold text-foreground sm:col-span-2">Internal workflow</h2>

          <label className="grid gap-2 text-sm font-semibold">
            Status
            <select name="status" defaultValue={detail.response.workflow_status} className="rounded-lg border border-border px-3 py-2">
              <option value="monitor_only">No action needed</option>
              <option value="branch_followup">Needs follow-up</option>
              <option value="controlled_investigation">Under investigation</option>
              <option value="immediate_escalation">Urgent escalation</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Assign team member
            <select name="assignedTo" defaultValue={detail.response.assigned_to ?? ""} className="rounded-lg border border-border px-3 py-2">
              <option value="">Unassigned</option>
              {detail.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.display_name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Tags (comma separated)
            <input name="tags" defaultValue={detail.response.internal_tags.join(", ")} className="rounded-lg border border-border px-3 py-2" />
          </label>

          {/* Controlled record fields — required for controlled_investigation and immediate_escalation */}
          <label className="grid gap-2 text-sm font-semibold">
            Controlled record type
            <select name="controlledRecordType" className="rounded-lg border border-border px-3 py-2">
              <option value="">Not applicable</option>
              <option value="investigation">Investigation</option>
              <option value="ncr">Non-conformance (NCR)</option>
              <option value="capa">Corrective action (CAPA)</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Controlled record reference
            <input name="controlledRecordReference" maxLength={200} placeholder="e.g. NCR-2026-0042" className="rounded-lg border border-border px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Reason
            <textarea name="controlledRecordReason" maxLength={2000} className="min-h-24 rounded-lg border border-border p-3" placeholder="Reason for controlled investigation or escalation" />
          </label>

          {/* Branch follow-up details */}
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Follow-up details
            <textarea name="followUpDetails" maxLength={2000} className="min-h-20 rounded-lg border border-border p-3" placeholder="Details for branch follow-up (if applicable)" />
          </label>

          {/* Outcome summary */}
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Outcome summary
            <textarea name="outcomeSummary" maxLength={5000} className="min-h-20 rounded-lg border border-border p-3" placeholder="Final outcome summary" />
          </label>

          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Add internal note
            <textarea name="note" maxLength={2000} className="min-h-28 rounded-lg border border-border p-3" />
          </label>
          <button className="justify-self-start rounded-lg bg-brand px-5 py-3 font-semibold text-white">Save workflow</button>
        </form>
      ) : (
        <p className="rounded-xl bg-background p-4 text-sm text-muted">Your role has read-only response workflow access.</p>
      )}

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="text-base font-semibold text-foreground">Internal notes</h2>
        <div className="mt-4 grid gap-3">
          {detail.notes.map((note) => (
            <article key={note.id} className="rounded-xl bg-background p-4">
              <p className="whitespace-pre-wrap break-words">{note.note}</p>
              <p className="mt-2 text-xs text-muted">{formatKuwaitDateTime(note.created_at)}</p>
            </article>
          ))}
        </div>
        {detail.notes.length === 0 ? <p className="mt-3 text-sm text-muted">No internal notes.</p> : null}
      </section>
    </div>
  );
}
