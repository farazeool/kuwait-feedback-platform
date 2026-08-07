import Link from "next/link";

import { listAlertConfigurations } from "@/features/alerts/config/server";
import { toggleAlertConfiguration, deleteAlertConfiguration } from "@/features/alerts/config/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function AlertConfigurationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const result = await listAlertConfigurations();
  const m = getMessages(result.context.profile.locale);
  const ruleTypeLabels: Record<string, string> = {
    satisfaction_threshold: "Satisfaction threshold",
    negative_feedback_threshold: "Negative feedback threshold",
    concern_frequency_threshold: "Concern frequency threshold",
    sudden_decline: "Sudden decline",
  };
  const severityLabels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  const locationMap = new Map(result.locations.map((loc) => [loc.id, loc]));
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Automation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Alert configurations</h1>
          <p className="mt-1 text-sm text-muted">Define rules that generate alerts automatically.</p>
        </div>
        <Link href="/dashboard/settings/alerts/new" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">New configuration</Link>
      </header>
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4">Configuration updated.</p> : null}
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4">Configuration created.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4">Configuration deleted.</p> : null}
      {notice.toggled ? <p className="rounded-xl bg-emerald-50 p-4">Configuration updated.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4">{m["common.error"]}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">Rule type</th>
              <th className="px-4 py-2.5 text-start">Threshold</th>
              <th className="px-4 py-2.5 text-start">Severity</th>
              <th className="px-4 py-2.5 text-start">Deduplication</th>
              <th className="px-4 py-2.5 text-start">Location</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                <td className="px-4 py-2.5">{ruleTypeLabels[row.rule_type] ?? row.rule_type}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.threshold_value}</td>
                <td className="px-4 py-2.5">{severityLabels[row.severity] ?? row.severity}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.deduplication_minutes} min</td>
                <td className="px-4 py-2.5">{row.location_id ? (locationMap.get(row.location_id)?.name_en ?? "—") : "All locations"}</td>
                <td className="px-4 py-2.5">{row.is_active ? "Active" : "Paused"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleAlertConfiguration}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="isActive" value={row.is_active ? "false" : "true"} />
                      <button className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:border-brand">{row.is_active ? "Pause" : "Resume"}</button>
                    </form>
                    <Link href={`/dashboard/settings/alerts/${row.id}`} className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:border-brand">Edit</Link>
                    <form action={deleteAlertConfiguration}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:border-red-400">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">No alert configurations yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
