import Link from "next/link";
import { getMessages } from "@/lib/i18n/messages";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { listTemplates } from "@/features/distribution/templates";
import { countKioskDevices } from "@/features/kiosk/count";

export default async function ChannelsPage() {
  const context = await requireOrganizationManagementContext();
  const messages = getMessages(context.profile.locale);
  const organizationId = context.membership?.organizationId ?? null;

  // The kiosk count is a cosmetic badge on the index card, so it is fetched
  // alongside the templates and degrades to 0 rather than failing the page.
  const [templatesResult, kioskCount] = await Promise.all([
    listTemplates("email"),
    countKioskDevices(organizationId),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Feedback Channels</h1>
        <p className="mt-1 text-sm text-muted">Configure feedback collection channels and distribution methods</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/settings/channels/email-signatures"
          className="rounded-xl border border-border bg-white p-6 transition-all hover:border-brand/40 hover:shadow-sm hover:-translate-y-0.5 group">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="font-semibold text-foreground group-hover:text-brand transition-colors">Email Signatures</h3>
          <p className="mt-1 text-xs text-muted">{templatesResult.templates.length} template{templatesResult.templates.length !== 1 ? "s" : ""}</p>
          <p className="mt-0.5 text-xs text-muted">Create and manage email signature feedback blocks</p>
        </Link>

        <Link href="/dashboard/settings/channels/kiosks"
          className="rounded-xl border border-border bg-white p-6 transition-all hover:border-brand/40 hover:shadow-sm hover:-translate-y-0.5 group">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h3 className="font-semibold text-foreground group-hover:text-brand transition-colors">Kiosks</h3>
          <p className="mt-1 text-xs text-muted">{kioskCount} device{kioskCount !== 1 ? "s" : ""}</p>
          <p className="mt-0.5 text-xs text-muted">Manage iPad kiosk devices, assign surveys, and monitor status</p>
        </Link>

        <Link href="/dashboard/settings/channels/campaigns"
          className="rounded-xl border border-border bg-white p-6 transition-all hover:border-brand/40 hover:shadow-sm hover:-translate-y-0.5 group">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="font-semibold text-foreground group-hover:text-brand transition-colors">Campaigns</h3>
          <p className="mt-1 text-xs text-muted">Manage feedback collection campaigns and track performance</p>
        </Link>

        <Link href="/dashboard/settings/channels/escalation"
          className="rounded-xl border border-border bg-white p-6 transition-all hover:border-brand/40 hover:shadow-sm hover:-translate-y-0.5 group">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="font-semibold text-foreground group-hover:text-brand transition-colors">Escalation Rules</h3>
          <p className="mt-1 text-xs text-muted">Configure smart escalation rules for automated alerts</p>
        </Link>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-800">Channel attribution</h3>
        <p className="mt-1 text-xs text-amber-700">
          All feedback channels (QR, Kiosk, Web, Email, Phone, WhatsApp, SMS, Tablet, Walk-in) are tracked via the generic
          distribution system. Responses from any channel flow through the same KPI, alert, investigation, and reporting pipeline.
          Future channels can be added without schema changes.
        </p>
      </div>
    </div>
  );
}
