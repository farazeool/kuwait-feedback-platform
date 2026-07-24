import Link from "next/link";
import { getMessages } from "@/lib/i18n/messages";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { listTemplates, getAssignments } from "@/features/email-signature/templates";

export default async function ChannelsPage() {
  const context = await requireOrganizationManagementContext();
  const messages = getMessages(context.profile.locale);
  const [templatesResult] = await Promise.all([listTemplates()]);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Settings</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Feedback Channels</h1>
        <p className="mt-1 text-sm text-muted">Configure feedback collection channels and distribution methods</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/settings/channels/email-signatures"
          className="rounded-xl border border-border bg-white p-6 transition-colors hover:border-brand/40"
        >
          <div className="mb-3 text-2xl">✉️</div>
          <h3 className="font-semibold text-foreground">Email Signatures</h3>
          <p className="mt-1 text-xs text-muted">
            {templatesResult.templates.length} template{templatesResult.templates.length !== 1 ? "s" : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">Create and manage email signature feedback blocks</p>
        </Link>

        <Link
          href="/dashboard/settings/channels/campaigns"
          className="rounded-xl border border-border bg-white p-6 transition-colors hover:border-brand/40"
        >
          <div className="mb-3 text-2xl">📊</div>
          <h3 className="font-semibold text-foreground">Campaigns</h3>
          <p className="mt-1 text-xs text-muted">Manage feedback collection campaigns and track performance</p>
        </Link>

        <Link
          href="/dashboard/settings/channels/escalation"
          className="rounded-xl border border-border bg-white p-6 transition-colors hover:border-brand/40"
        >
          <div className="mb-3 text-2xl">🔔</div>
          <h3 className="font-semibold text-foreground">Escalation Rules</h3>
          <p className="mt-1 text-xs text-muted">Configure smart escalation rules for automated alerts and investigations</p>
        </Link>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-800">Channel tracking</h3>
        <p className="mt-1 text-xs text-amber-700">
          All feedback channels (QR, Kiosk, Web, Email, Phone, WhatsApp, SMS, Tablet, Walk-in) are tracked in the KPI engine.
          Responses from any channel automatically feed into alerts, investigations, corrective actions, evidence, and reports.
          No separate configuration needed — just use the appropriate channel when creating survey distribution links.
        </p>
      </div>
    </div>
  );
}
