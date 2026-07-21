import Link from "next/link";

import { AccessibleBarChart } from "@/components/analytics/bar-chart";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { MetricCard } from "@/components/analytics/metric-card";
import { PilotChecklist } from "@/components/dashboard/pilot-checklist";
import { getAnalyticsDashboard } from "@/features/analytics/server";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const result = await getAnalyticsDashboard(raw);
  const analytics = result.overview;
  if (!analytics) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted">Create an organization before viewing analytics.</div>;
  const ranked = analytics.location_comparison.filter((row) => row.sufficient_data && row.change !== null && row.change !== undefined);
  const improved = [...ranked].sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const declining = [...ranked].sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  const query = new URLSearchParams(Object.entries(raw).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();
  return (
    <div className="grid gap-6">
      <PilotChecklist />
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Business intelligence</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Feedback overview</h1><p className="mt-1 text-sm text-muted">{result.range.from} – {result.range.to} · Asia/Kuwait</p></div><a className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-brand" href={`/api/exports/responses?${query}`}>Export responses CSV</a></header>
      <AnalyticsFilters values={{ ...raw, ...result.filters }} organizations={result.organizations} locations={result.locations} surveys={result.surveys} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="All-time responses" value={String(analytics.total_responses)} detail="Within selected organization/location/survey scope" />
        <MetricCard label="Responses in range" value={String(analytics.selected_responses)} />
        <MetricCard label="Average rating" value={analytics.average_normalized === null ? "No data" : `${analytics.average_normalized}%`} detail="Normalized to 0–100 for safe cross-scale comparison" />
        <MetricCard label="Low-score responses" value={String(analytics.low_score_count)} detail="Normalized score of 40% or below" />
        <MetricCard label="Open alerts" value={String(analytics.open_alert_count)} detail="Open and acknowledged alerts" />
      </div>
      {analytics.rating_scales.length > 1 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Multiple rating scales are present. Comparisons use documented 0–100 normalization; raw scores are not combined.</p> : null}
      <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Response trend" summary="Response completion volume in Kuwait-local periods"><AccessibleBarChart title="Response trend" items={analytics.response_trend.map((item) => ({ label: item.period, value: item.count }))} /></ChartCard><ChartCard title="Rating distribution" summary="Normalized bands; axis begins at zero"><AccessibleBarChart title="Rating distribution" items={analytics.rating_distribution.map((item) => ({ label: `${item.band * 20}–${item.band === 4 ? 100 : item.band * 20 + 19}%`, value: item.count }))} /></ChartCard></div>
      <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Survey comparison" summary="Exact response counts and normalized averages"><AccessibleBarChart title="Survey comparison" suffix="%" items={analytics.survey_comparison.map((item) => ({ label: item.title_en ?? "Survey", value: item.average_normalized ?? 0, detail: `${item.response_count} responses` }))} /></ChartCard>{result.canCompareLocations ? <ChartCard title="Location comparison" summary="Labels require at least five responses"><AccessibleBarChart title="Location comparison" suffix="%" items={analytics.location_comparison.map((item) => ({ label: item.name_en ?? "Location", value: item.average_normalized ?? 0, detail: `${item.response_count} responses${item.sufficient_data ? "" : "; insufficient data"}` }))} /></ChartCard> : <ChartCard title="Location comparison" summary="Restricted for location managers"><p className="text-sm text-muted">Your role can view assigned-location analytics but not organization-wide branch rankings.</p></ChartCard>}</div>
      <div className="grid gap-3 sm:grid-cols-2"><MetricCard label="Most improved location" value={improved && (improved.change ?? 0) > 0 ? improved.name_en ?? "Location" : "Insufficient data"} detail={improved && (improved.change ?? 0) > 0 ? `Change ${improved.change} points; ${improved.response_count} current responses` : "Requires at least five responses in both current and previous periods"} /><MetricCard label="Declining location" value={declining && (declining.change ?? 0) < 0 ? declining.name_en ?? "Location" : "Insufficient data"} detail={declining && (declining.change ?? 0) < 0 ? `Change ${declining.change} points; ${declining.response_count} current responses` : "Requires at least five responses in both current and previous periods"} /></div>
      <ChartCard title="Low-score trend" summary="Responses at or below 40% normalized"><AccessibleBarChart title="Low-score trend" items={analytics.low_score_trend.map((item) => ({ label: item.period, value: item.count }))} /></ChartCard>
      <section className="overflow-x-auto rounded-xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold text-foreground">Recent responses</h2></div><table className="w-full min-w-[650px] text-sm"><thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 text-start">Submitted</th><th className="px-4 py-2.5 text-start">Survey</th><th className="px-4 py-2.5 text-start">Location</th><th className="px-4 py-2.5 text-start">Rating</th><th className="px-4 py-2.5 text-start">Workflow</th></tr></thead><tbody>{analytics.recent_responses.map((response) => <tr key={response.id} className="border-t border-border transition-colors hover:bg-surface-muted"><td className="px-4 py-2.5"><Link className="font-medium text-brand hover:underline" href={`/dashboard/responses/${response.id}`}>{formatKuwaitDateTime(response.submitted_at)}</Link></td><td className="px-4 py-2.5">{response.survey_title}</td><td className="px-4 py-2.5">{response.location_name}</td><td className="px-4 py-2.5 tabular-nums">{response.normalized_rating === null ? "—" : `${response.normalized_rating}%`}</td><td className="px-4 py-2.5">{response.workflow_status.replaceAll("_", " ")}</td></tr>)}</tbody></table>{analytics.recent_responses.length === 0 ? <p className="p-6 text-sm text-muted">No responses match the selected filters.</p> : null}</section>
    </div>
  );
}

function ChartCard({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return <section className="grid gap-4 rounded-xl border border-border bg-white p-5"><div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-0.5 text-xs text-muted">{summary}</p></div>{children}</section>;
}
