import Link from "next/link";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getServerEnv } from "@/lib/env/server";
import { listTemplates, listAssignments, resolveSubjectLabel } from "@/features/distribution/templates";
import { renderEmailSignatureHtml } from "@/features/distribution/renderers/email";
import { archiveTemplate, revokeAssignment } from "@/features/distribution/actions";
import { CopyLinkButton } from "@/components/surveys/copy-link-button";
import { CopySignatureButton } from "@/components/distribution/copy-signature-button";
import { ViewHtmlCode } from "@/components/distribution/view-html-code";
import { InstallSignatureDialog } from "@/components/distribution/install-signature-dialog";
import { CreateAssignmentButton } from "@/components/distribution/create-assignment-button";
import { AssignmentResponsesTrigger } from "@/components/distribution/assignment-responses-trigger";
import { ClientResponseList, type AssignmentOption } from "@/components/distribution/client-response-list";
import { getSignatureSubjectReport } from "@/features/distribution/report";
import { getEmailSignatureSentimentReport } from "@/features/distribution/sentiment-report.server";
import { resolveAnalyticsRange } from "@/features/analytics/dates";
import { MetricCard } from "@/components/analytics/metric-card";
import { AccessibleBarChart } from "@/components/analytics/bar-chart";
import { listTeam } from "@/features/team/server";

export default async function EmailSignaturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const notice = await searchParams;
  const tab = notice.tab ?? "templates";
  const [templatesResult, assignmentsResult, ctx, teamResult] = await Promise.all([
    listTemplates("email"),
    listAssignments(),
    requireOrganizationManagementContext(),
    listTeam({ page: "1" }).catch(() => ({ members: [] })),
  ]);
  const env = getServerEnv();

  let reportData = null;
  // A template must be selected before fetching report data. Mixing templates
  // with different rating scales (yes_no / three_option / full 5-point) into a
  // single average is intentionally unsupported for pilot — see report.ts and
  // migration 20260727000002.
  let sentimentReport = null;
  if (tab === "reports" && notice.templateId) {
    const range = resolveAnalyticsRange({ preset: notice.preset ?? "30d", from: notice.from, to: notice.to });
    try {
      reportData = await getSignatureSubjectReport({
        organizationId: ctx.organization!.id,
        startAt: range.start,
        endAt: range.end,
        subjectType: notice.subjectType,
        templateId: notice.templateId,
        locationId: notice.locationId,
      });
    } catch {
      reportData = { subjects: [], totals: { count: 0, avg_rating: null } };
    }
    try {
      sentimentReport = await getEmailSignatureSentimentReport({
        organizationId: ctx.organization!.id,
        startAt: range.start,
        endAt: range.end,
      });
    } catch {
      sentimentReport = null;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgName = (ctx.organization as any)?.name_en ?? (ctx.organization?.nameEn ?? "Organization");
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  // Small, already-resolved projection for the Individual Responses drill-down.
  // Only active assignments for the selected template are offered, and only the
  // opaque id + display label cross the server/client boundary — the full
  // assignment record (open index signature, internal FKs) stays server-side.
  const responseAssignmentOptions: AssignmentOption[] =
    tab === "reports" && notice.templateId
      ? assignmentsResult.assignments
          .filter((a) => a.status === "active" && a.template_id === notice.templateId)
          .map((a) => ({ id: a.id, subjectLabel: resolveSubjectLabel(a) }))
      : [];

  return (
    <div className="grid gap-6">
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template created successfully.</p> : null}
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template updated.</p> : null}
      {notice.assigned ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signatures assigned.</p> : null}
      {notice.revoked ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signature revoked.</p> : null}
      {notice.error === "duplicate" ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">This employee already has an active assignment for this template.</p> : null}
      {notice.error && notice.error !== "duplicate" ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">An error occurred. Please try again.</p> : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Feedback Channels</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Email Signatures</h1>
          <p className="mt-1 text-sm text-muted">Create and manage email signature feedback blocks</p>
        </div>
        <Link href="/dashboard/settings/channels/email-signatures/new-template" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          New template
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
        <Link href="/dashboard/settings/channels/email-signatures?tab=templates"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "templates" ? "bg-white text-foreground shadow-sm" : "text-muted"}`}>
          Templates ({templatesResult.templates.length})
        </Link>
        <Link href="/dashboard/settings/channels/email-signatures?tab=assignments"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "assignments" ? "bg-white text-foreground shadow-sm" : "text-muted"}`}>
          Assignments ({assignmentsResult.assignments.length})
        </Link>
        <Link href="/dashboard/settings/channels/email-signatures?tab=reports"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "reports" ? "bg-white text-foreground shadow-sm" : "text-muted"}`}>
          Reports
        </Link>
        <Link href="/dashboard/settings/channels/email-signatures?tab=setup"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "setup" ? "bg-white text-foreground shadow-sm" : "text-muted"}`}>
          Installation guide
        </Link>
      </div>

      {tab === "templates" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templatesResult.templates.map((tpl: { id: string; template_name: string; is_active: boolean }) => {
            const html = renderEmailSignatureHtml(
              templatesResult.templates.find((t: { id: string }) => t.id === tpl.id)!,
              "preview", appUrl, orgName,
            );
            return (
              <div key={tpl.id} className="rounded-xl border border-border bg-white p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{tpl.template_name}</h3>
                    <p className="text-xs text-muted">Email channel</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tpl.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                    {tpl.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mb-3 rounded-lg border border-border bg-white p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
                <div className="flex flex-wrap gap-1.5">
                  <Link href={`/dashboard/settings/channels/email-signatures/${tpl.id}/edit`} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-brand">Edit</Link>
                  {tpl.is_active && (
                    <form action={archiveTemplate} className="inline">
                      <input type="hidden" name="templateId" value={tpl.id} />
                      <button className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:border-amber-400">Archive</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {templatesResult.templates.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
              <p className="font-semibold">No email signature templates yet</p>
              <Link href="/dashboard/settings/channels/email-signatures/new-template" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Create template</Link>
            </div>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <>
          {assignmentsResult.assignments.length > 0 && (
            <div className="flex justify-end">
              <CreateAssignmentButton
                employees={teamResult.members ?? []}
                templates={templatesResult.templates}
                variant="header"
              />
            </div>
          )}
          <div className="grid gap-4">
          {assignmentsResult.assignments.map((a: Record<string, unknown>) => {
            const link = `${appUrl}/feedback/l/${a.public_token}`;
            const employee = a.employee as Record<string, unknown> | undefined;
            const template = a.template as Record<string, unknown> | undefined;
            const templateRecord = templatesResult.templates.find((t) => t.id === a.template_id);
            const html = templateRecord
              ? renderEmailSignatureHtml(templateRecord, a.public_token as string, appUrl, orgName)
              : "";
            const plainText = templateRecord
              ? `${orgName}\nHow was your experience?\nRate us: ${link}`
              : "";

            return (
              <div key={a.id as string} className="rounded-xl border border-border bg-white p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {String(employee?.display_name ?? (a.assigned_location_id ? "Location" : "Unknown"))}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-700"}`}
                      >
                        {a.status as string}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Template: {String(template?.template_name ?? "—")} • {a.response_count as number} response
                      {(a.response_count as number) === 1 ? "" : "s"} • {a.click_count as number} click
                      {(a.click_count as number) === 1 ? "" : "s"}
                    </p>
                  </div>
                  {a.status === "active" && (
                    <div className="flex items-center gap-2">
                      <AssignmentResponsesTrigger
                        assignmentId={a.id as string}
                        subjectLabel={String(employee?.display_name ?? (a.assigned_location_id ? "Location" : "Unknown"))}
                        responseCount={a.response_count as number}
                      />
                      <form action={revokeAssignment}>
                        <input type="hidden" name="assignmentId" value={a.id as string} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-400"
                        >
                          Revoke
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                {a.status === "active" && html && (
                  <>
                    <div className="mb-4 rounded-lg border border-border bg-gray-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Signature Preview</p>
                      <div
                        className="rounded-lg border border-border bg-white p-3 text-sm"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                       <InstallSignatureDialog
                         html={html}
                         plainText={plainText}
                         feedbackLink={link}
                         employeeName={String(employee?.display_name ?? "Assignment")}
                       />
                       <CopySignatureButton html={html} plainText={plainText} label="Copy signature" />
                       <CopyLinkButton value={link} labelEn="Copy Feedback Link" copiedLabelEn="Copied!" />
                       <ViewHtmlCode html={html} title={`Signature HTML for ${String(employee?.display_name ?? "Assignment")}`} />
                     </div>
                  </>
                )}

                {a.status !== "active" && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
                    This assignment is {a.status as string}. The signature cannot be copied.
                  </div>
                )}
              </div>
            );
          })}
            {assignmentsResult.assignments.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
                <p className="font-semibold">No assignments yet</p>
                <p className="mt-1">Create an assignment to generate employee-specific signatures.</p>
                <CreateAssignmentButton
                  employees={teamResult.members ?? []}
                  templates={templatesResult.templates}
                  variant="empty-state"
                />
              </div>
            )}
          </div>
        </>
      )}

      {tab === "reports" && (
        <div className="grid gap-6">
          {/* Filters: template selector (required) + date preset */}
          <div className="grid gap-3">
            {/* Template selector — a template must be chosen before data loads,
                so ratings from templates with different rating scales are never
                blended into one average. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">Template:</span>
              {templatesResult.templates.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/settings/channels/email-signatures?tab=reports&templateId=${t.id}&preset=${notice.preset ?? "30d"}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${notice.templateId === t.id ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:border-brand"}`}
                >
                  {t.template_name}
                </Link>
              ))}
              {templatesResult.templates.length === 0 && (
                <span className="text-xs text-muted">No templates yet.</span>
              )}
            </div>
            {/* Date presets — only shown once a template is selected */}
            {notice.templateId && (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "7d", label: "Last 7 days" },
                  { key: "30d", label: "Last 30 days" },
                  { key: "90d", label: "Last 90 days" },
                ].map(({ key, label }) => (
                  <Link
                    key={key}
                    href={`/dashboard/settings/channels/email-signatures?tab=reports&templateId=${notice.templateId}&preset=${key}`}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${notice.preset === key || (!notice.preset && key === "30d") ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:border-brand"}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {!notice.templateId ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
              Select a template above to view ratings. Each template uses a single rating scale, so averages are only meaningful within one template.
            </div>
          ) : (
            <>
              {/* Headline metrics */}
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard label="Total ratings" value={String(reportData?.totals?.count ?? 0)} />
                <MetricCard
                  label="Average rating"
                  value={reportData?.totals?.avg_rating != null ? `${reportData.totals.avg_rating} / 5` : "—"}
                />
              </div>

              {/* Per-subject bar chart */}
              {/* Per-subject bar chart */}
              {reportData && reportData.subjects.length > 0 ? (
                <div className="rounded-xl border border-border bg-white p-6">
                  <h2 className="mb-4 text-base font-semibold text-foreground">Ratings by subject</h2>
                  <AccessibleBarChart
                    title="Average rating by subject"
                    suffix=" / 5"
                    items={reportData.subjects.map((s) => ({
                      label: s.label,
                      value: s.avg_rating ?? 0,
                      detail: `${s.count} rating${s.count === 1 ? "" : "s"}`,
                    }))}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
                  No rating data for this period.
                </div>
              )}

              {/* Per-employee performance + channel breakdown — built from the
                  follow-up sentiment RPC, which has per-employee + per-channel
                  aggregates and contact-request / comment-rate signals. */}
              {sentimentReport ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <section
                    className="rounded-xl border border-border bg-white p-6"
                    data-testid="employee-performance-panel"
                  >
                    <h2 className="mb-4 text-base font-semibold text-foreground">
                      Team performance
                    </h2>
                    {sentimentReport.by_employee.length === 0 ? (
                      <p className="text-sm text-muted">
                        No employee ratings captured yet for this period.
                      </p>
                    ) : (
                      <ul className="grid gap-2">
                        {sentimentReport.by_employee.slice(0, 10).map((row) => (
                          <li
                            key={row.employee_id ?? "unknown"}
                            className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
                          >
                            <span className="truncate text-foreground">
                              {row.employee_name ?? "Unknown employee"}
                            </span>
                            <span className="text-xs font-medium text-muted">
                              {row.count} rating{row.count === 1 ? "" : "s"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {sentimentReport.by_employee.length > 10 ? (
                      <p className="mt-2 text-xs text-muted">
                        Showing top 10 of {sentimentReport.by_employee.length} employees.
                      </p>
                    ) : null}
                  </section>

                  <section className="rounded-xl border border-border bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-foreground">
                      Engagement signals
                    </h2>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-border p-3">
                        <dt className="text-xs text-muted">Comment rate</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {sentimentReport.comment_rate != null
                            ? `${sentimentReport.comment_rate}%`
                            : "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <dt className="text-xs text-muted">Follow-up completion</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {sentimentReport.follow_up_completion_rate != null
                            ? `${sentimentReport.follow_up_completion_rate}%`
                            : "—"}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <dt className="text-xs text-muted">Contact requested</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {sentimentReport.contact_requested_count}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <dt className="text-xs text-muted">Unresolved contacts</dt>
                        <dd className="mt-1 text-base font-semibold text-amber-700">
                          {sentimentReport.unresolved_contact_requests}
                        </dd>
                      </div>
                    </dl>
                    {sentimentReport.by_channel.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Channel breakdown
                        </p>
                        <ul className="mt-2 grid gap-1 text-xs">
                          {sentimentReport.by_channel.map((row) => (
                            <li
                              key={row.channel}
                              className="flex items-center justify-between"
                            >
                              <span className="text-foreground">{row.channel}</span>
                              <span className="text-muted">{row.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}

              {/* Individual responses — detailed per-submission drill-down that
                  complements (does not replace) the aggregate analytics above. */}
              <ClientResponseList assignments={responseAssignmentOptions} />
            </>
          )}
        </div>
      )}

      {tab === "setup" && (
        <div className="grid gap-6 rounded-xl border border-border bg-white p-6">
          <h2 className="text-lg font-bold text-foreground">Installation Guide</h2>
          <p className="text-sm text-muted">Follow the instructions to add your email signature feedback block.</p>
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Gmail</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
              <li>Open Gmail → Settings → See all settings</li>
              <li>Scroll to Signature → Create new</li>
              <li>Paste the copied HTML into the signature editor</li>
              <li>Save Changes</li>
            </ol>
          </section>
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Microsoft Outlook (Desktop)</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
              <li>File → Options → Mail → Signatures</li>
              <li>New → Paste HTML → Set as default</li>
              <li>OK to save</li>
            </ol>
          </section>
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-800">Organization-wide deployment</h3>
            <p className="mt-1 text-sm text-amber-700">Each employee must add the signature manually. For bulk deployment, generate individual links via the Bulk Assign option.</p>
          </section>
        </div>
      )}
    </div>
  );
}
