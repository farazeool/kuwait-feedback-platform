import Link from "next/link";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { getServerEnv } from "@/lib/env/server";
import { listTemplates, listAssignments } from "@/features/distribution/templates";
import { renderEmailSignatureHtml } from "@/features/distribution/renderers/email";
import { archiveTemplate, bulkAssign, revokeAssignment } from "@/features/distribution/actions";
import { CopyLinkButton } from "@/components/surveys/copy-link-button";

export default async function EmailSignaturesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const notice = await searchParams;
  const tab = notice.tab ?? "templates";
  const [templatesResult, assignmentsResult, ctx] = await Promise.all([
    listTemplates("email"),
    listAssignments(),
    requireOrganizationManagementContext(),
  ]);
  const env = getServerEnv();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgName = (ctx.organization as any)?.name_en ?? (ctx.organization?.nameEn ?? "Organization");
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="grid gap-6">
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template created successfully.</p> : null}
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Template updated.</p> : null}
      {notice.assigned ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signatures assigned.</p> : null}
      {notice.revoked ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Signature revoked.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">An error occurred. Please try again.</p> : null}

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
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tpl.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
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
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2.5 text-start">Target</th><th className="px-4 py-2.5 text-start">Template</th><th className="px-4 py-2.5 text-start">Status</th><th className="px-4 py-2.5 text-start">Clicks</th><th className="px-4 py-2.5 text-start">Responses</th><th className="px-4 py-2.5 text-start">Link</th><th className="px-4 py-2.5 text-start">Actions</th></tr>
            </thead>
            <tbody>
              {assignmentsResult.assignments.map((a: Record<string, unknown>) => {
                const link = `${appUrl}/feedback/l/${a.public_token}`;
                const employee = a.employee as Record<string, unknown> | undefined;
                const template = a.template as Record<string, unknown> | undefined;
                return (
                  <tr key={a.id as string} className="border-t border-border">
                    <td className="px-4 py-2.5">{String(employee?.displayName ?? (a.assigned_location_id ? "Location" : "Unknown"))}</td>
                    <td className="px-4 py-2.5">{String(template?.template_name ?? "—")}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{a.status as string}</span></td>
                    <td className="px-4 py-2.5 tabular-nums">{a.click_count as number}</td>
                    <td className="px-4 py-2.5 tabular-nums">{a.response_count as number}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[10px] text-muted">{link}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <CopyLinkButton value={link} labelEn="Copy" copiedLabelEn="Copied" />
                        {a.status === "active" && (
                          <form action={revokeAssignment} className="inline">
                            <input type="hidden" name="assignmentId" value={a.id as string} />
                            <button className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-700 hover:border-red-400">Revoke</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assignmentsResult.assignments.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">No assignments yet.</td></tr>
              )}
            </tbody>
          </table>
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
