import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getServerEnv } from "@/lib/env/server";
import { listTemplates, getAssignments, buildSignatureHtml } from "@/features/email-signature/templates";
import { archiveTemplate, duplicateTemplate, revokeAssignment, regenerateLink, bulkAssign } from "@/features/email-signature/actions";

export default async function EmailSignaturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const notice = await searchParams;
  const tab = notice.tab ?? "templates";
  const [templatesResult, assignmentsResult, context] = await Promise.all([
    listTemplates(),
    getAssignments(),
    requireOrganizationManagementContext(),
  ]);
  const env = getServerEnv();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgName = (context.organization as any)?.name_en ?? (context.organization?.nameEn ?? "Organization");
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="grid gap-6">
      {/* Notifications */}
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template created successfully.</p> : null}
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template updated.</p> : null}
      {notice.duplicated ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template duplicated.</p> : null}
      {notice.assigned ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signatures assigned.</p> : null}
      {notice.revoked ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signature revoked.</p> : null}
      {notice.regenerated ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Link regenerated.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">An error occurred. Please try again.</p> : null}

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Feedback Channels</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Email Signatures</h1>
          <p className="mt-1 text-sm text-muted">
            Create and manage email signature feedback blocks for your team
          </p>
        </div>
        <Link
          href="/dashboard/settings/channels/email-signatures/new-template"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          New template
        </Link>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
        <Link
          href="/dashboard/settings/channels/email-signatures?tab=templates"
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "templates" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Templates ({templatesResult.templates.length})
        </Link>
        <Link
          href="/dashboard/settings/channels/email-signatures?tab=assignments"
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "assignments" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Assignments ({assignmentsResult.assignments.length})
        </Link>
        <Link
          href="/dashboard/settings/channels/email-signatures?tab=setup"
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "setup" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Installation guide
        </Link>
        <Link
          href="/dashboard/settings/channels/email-signatures?tab=bulk"
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "bulk" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          Bulk assign
        </Link>
      </div>

      {/* Templates tab */}
      {tab === "templates" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templatesResult.templates.map((tpl) => {
            const html = buildSignatureHtml(tpl, "preview", appUrl, orgName);
            return (
              <div key={tpl.id} className="rounded-xl border border-border bg-white p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{tpl.template_name}</h3>
                    <p className="text-xs text-muted capitalize">{tpl.rating_style} &middot; {tpl.layout}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    tpl.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {tpl.status}
                  </span>
                </div>

                {/* Live preview */}
                <div className="mb-3 rounded-lg border border-border bg-white p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />

                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={`/dashboard/settings/channels/email-signatures/${tpl.id}/edit`}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-brand"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/dashboard/settings/channels/email-signatures/${tpl.id}/assign`}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-brand"
                  >
                    Assign
                  </Link>
                  <form action={duplicateTemplate} className="inline">
                    <input type="hidden" name="templateId" value={tpl.id} />
                    <button className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-brand">
                      Duplicate
                    </button>
                  </form>
                  {tpl.status === "active" && (
                    <form action={archiveTemplate} className="inline">
                      <input type="hidden" name="templateId" value={tpl.id} />
                      <button className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:border-amber-400">
                        Archive
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {templatesResult.templates.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">
              <p className="font-semibold">No templates yet</p>
              <p className="mt-1">Create your first email signature template to get started.</p>
              <Link href="/dashboard/settings/channels/email-signatures/new-template" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                Create template
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Assignments tab */}
      {tab === "assignments" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start">Employee</th>
                <th className="px-4 py-2.5 text-start">Template</th>
                <th className="px-4 py-2.5 text-start">Status</th>
                <th className="px-4 py-2.5 text-start">Clicks</th>
                <th className="px-4 py-2.5 text-start">Responses</th>
                <th className="px-4 py-2.5 text-start">Last clicked</th>
                <th className="px-4 py-2.5 text-start">Signature link</th>
                <th className="px-4 py-2.5 text-start">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignmentsResult.assignments.map((a) => {
                const sigHtml = buildSignatureHtml(
                  templatesResult.templates.find((t) => t.id === a.template_id) ?? {
                    id: "", organization_id: "", template_name: "", heading_en: "How was your experience?",
                    heading_ar: "", description_en: null, description_ar: null, rating_style: "emoji",
                    layout: "horizontal", survey_id: null, show_logo: true, show_business_name: true,
                    show_privacy_notice: false, privacy_notice_en: null, privacy_notice_ar: null,
                    brand_color: "#2563eb", icon_size: "medium", alignment: "left", thank_you_en: null,
                    thank_you_ar: null, follow_up_enabled: true, auto_submit_positive: true,
                    is_default: false, status: "active", created_at: "",
                  },
                  a.public_token, appUrl, orgName,
                );
                const link = `${appUrl}/feedback/s/${a.public_token}`;
                return (
                  <tr key={a.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(a as any).employee?.display_name ?? "Location-wide"}
                    </td>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <td className="px-4 py-2.5">{(a as any).template?.template_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        a.status === "active" ? "bg-emerald-50 text-emerald-700" :
                        a.status === "paused" ? "bg-amber-50 text-amber-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{a.click_count}</td>
                    <td className="px-4 py-2.5 tabular-nums">{a.response_count}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{a.last_clicked_at ? new Date(a.last_clicked_at).toLocaleDateString() : "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[10px] text-muted">{link}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => navigator.clipboard.writeText(link)} className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium hover:border-brand">Copy</button>
                        <form action={regenerateLink} className="inline">
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <button className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium hover:border-brand">Regen</button>
                        </form>
                        {a.status === "active" && (
                          <form action={revokeAssignment} className="inline">
                            <input type="hidden" name="assignmentId" value={a.id} />
                            <button className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-700 hover:border-red-400">Revoke</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assignmentsResult.assignments.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">No assignments yet. Create a template and assign it to employees or locations.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Installation Guide tab */}
      {tab === "setup" && (
        <div className="grid gap-6 rounded-xl border border-border bg-white p-6">
          <h2 className="text-lg font-bold text-foreground">Installation Guide</h2>
          <p className="text-sm text-muted">Follow the instructions below to add your email signature feedback block to different email clients.</p>

          {/* Gmail */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Gmail</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
              <li>Open Gmail in your browser.</li>
              <li>Click the gear icon (Settings) in the top-right corner.</li>
              <li>Click &quot;See all settings.&quot;</li>
              <li>Scroll to the &quot;Signature&quot; section.</li>
              <li>Click &quot;Create new&quot; and name your signature.</li>
              <li>In the signature editor, paste the copied HTML code.</li>
              <li>If the formatting looks wrong, paste into a plain-text editor first, then copy and paste into Gmail.</li>
              <li>Scroll down and click &quot;Save Changes.&quot;</li>
              <li>Send a test email to yourself and click a rating to verify.</li>
            </ol>
          </section>

          {/* Outlook Desktop */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Microsoft Outlook (Desktop)</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
              <li>Open Outlook and click &quot;File&quot; &rarr; &quot;Options&quot; &rarr; &quot;Mail.&quot;</li>
              <li>Click &quot;Signatures...&quot;</li>
              <li>Click &quot;New&quot; and name your signature.</li>
              <li>In the editor, paste the copied HTML code into the &quot;Edit signature&quot; field.</li>
              <li>Set this signature as the default for new messages and replies.</li>
              <li>Click &quot;OK&quot; and then &quot;OK&quot; again.</li>
              <li>Create a new email to see your signature.</li>
              <li>Note: Outlook may strip some CSS. The rating links will still work.</li>
            </ol>
          </section>

          {/* Apple Mail */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Apple Mail (macOS)</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
              <li>Open the Mail app and click &quot;Mail&quot; &rarr; &quot;Settings...&quot;</li>
              <li>Click the &quot;Signatures&quot; tab.</li>
              <li>Select your email account on the left.</li>
              <li>Click the &quot;+&quot; button to create a new signature.</li>
              <li>Replace the default text with the copied HTML in the preview pane.</li>
              <li>Apple Mail renders HTML signatures well. The emoji and stars will display correctly.</li>
              <li>Close settings and compose a new email to test.</li>
            </ol>
          </section>

          {/* Microsoft 365 / Google Workspace */}
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-800">Organization-wide deployment</h3>
            <p className="mt-1 text-sm text-amber-700">
              Automatic organization-wide deployment is not yet integrated with Microsoft 365 or Google Workspace administration APIs.
              Each employee must add the signature manually using the instructions above.
              For bulk deployment, generate individual links for each employee and distribute the HTML snippet via email or an internal guide.
            </p>
          </section>

          {/* Troubleshooting */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground">Troubleshooting</h3>
            <dl className="mt-2 grid gap-3 text-sm">
              <div><dt className="font-medium">Emojis don&apos;t appear in Outlook</dt><dd className="text-muted">Outlook uses Windows emoji fonts which may differ. Use the star rating style instead for better Outlook compatibility.</dd></div>
              <div><dt className="font-medium">Formatting changes after pasting</dt><dd className="text-muted">Paste into a plain-text editor first, copy from there, then paste into the email signature editor.</dd></div>
              <div><dt className="font-medium">Links don&apos;t work</dt><dd className="text-muted">Ensure the full URL is included. Test by hovering over the link &mdash; the browser status bar should show your platform URL.</dd></div>
              <div><dt className="font-medium">Signature is too large</dt><dd className="text-muted">Use &quot;small&quot; icon size in the template settings. Disable the logo or business name if needed.</dd></div>
              <div><dt className="font-medium">Mobile signature looks different</dt><dd className="text-muted">Mobile email clients often strip styling. The rating links will still work and open in the browser.</dd></div>
              <div><dt className="font-medium">Old signature still appearing</dt><dd className="text-muted">Clear your email client&apos;s signature cache, remove old signatures, and verify the default signature is set to the new one.</dd></div>
            </dl>
          </section>
        </div>
      )}

      {/* Bulk assign tab */}
      {tab === "bulk" && (
        <form action={bulkAssign} className="grid gap-5 rounded-xl border border-border bg-white p-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">Bulk Assign Signatures</h2>
            <p className="mt-1 text-sm text-muted">Assign a signature template to multiple employees or locations at once.</p>
          </div>

          <label className="grid gap-1 text-sm font-semibold">
            Template
            <select name="templateId" required className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">Select a template</option>
              {templatesResult.templates.filter((t) => t.status === "active").map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.template_name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Survey
            <select name="surveyId" required className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">Select a survey</option>
              {templatesResult.surveys.map((s: { id: string; title_en: string }) => (
                <option key={s.id} value={s.id}>{s.title_en}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Campaign (optional)
            <select name="campaignId" className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">No campaign</option>
            </select>
          </label>

          <fieldset className="grid gap-3 rounded-lg border border-border p-4">
            <legend className="text-sm font-semibold">Assign to</legend>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Employees (comma-separated IDs or &quot;all&quot;)</span>
              <input name="employeeIds" className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g., all" />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Or locations (comma-separated IDs)</span>
              <input name="locationIds" className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Leave empty to assign to employees only" />
            </label>

            <p className="text-xs text-muted">At least one employee or location is required. Existing assignments will be updated.</p>
          </fieldset>

          <div className="flex gap-3">
            <Link href="/dashboard/settings/channels/email-signatures" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancel</Link>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Assign signatures</button>
          </div>
        </form>
      )}
    </div>
  );
}
