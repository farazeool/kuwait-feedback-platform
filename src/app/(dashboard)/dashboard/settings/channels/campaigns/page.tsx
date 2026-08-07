import Link from "next/link";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { listCampaigns } from "@/features/campaigns/server";
import { EmptyState } from "@/components/dashboard/empty-state";
import { createCampaign } from "@/features/campaigns/actions";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function CampaignsPage() {
  const context = await requireOrganizationManagementContext();
  const { campaigns } = await listCampaigns();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Channels</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted">Manage feedback collection campaigns and track performance</p>
        </div>
        <Link
          href="/dashboard/settings/channels"
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium"
        >
          ← Back to Channels
        </Link>
      </header>

      {campaigns.length === 0 ? (
        <EmptyState
          icon="surveys"
          title="No campaigns yet"
          description="Create a campaign to track feedback collection for a specific time period, channel, or promotion."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start">Name</th>
                <th className="px-4 py-2.5 text-start">Channel</th>
                <th className="px-4 py-2.5 text-start">Period</th>
                <th className="px-4 py-2.5 text-start">Status</th>
                <th className="px-4 py-2.5 text-start">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: Record<string, unknown>) => (
                <tr key={c.id as string} className="border-t border-border transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-foreground">{c.name_en as string}</span>
                    {c.name_ar ? <p className="text-xs text-muted" dir="rtl">{c.name_ar as string}</p> : null}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{c.channel as string}</td>
                  <td className="px-4 py-2.5">
                    {c.starts_at ? formatKuwaitDateTime(c.starts_at as string) : "—"}
                    {c.ends_at ? ` → ${formatKuwaitDateTime(c.ends_at as string)}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(c.status as string) === "active" ? "bg-emerald-50 text-emerald-700" : "bg-background text-muted"}`}>
                      {(c.status as string) ?? "active"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{formatKuwaitDateTime(c.created_at as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
