import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessibleBarChart } from "@/components/analytics/bar-chart";
import { MetricCard } from "@/components/analytics/metric-card";
import { getAnalyticsDashboard } from "@/features/analytics/server";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function LocationDetailPage({ params, searchParams }: { params: Promise<{ locationId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ locationId }, raw] = await Promise.all([params, searchParams]);
  const scoped = await getAnalyticsDashboard({ ...raw, location: locationId });
  const location = scoped.locations.find((item) => item.id === locationId);
  if (!location || !scoped.overview) notFound();
  const organization = scoped.canCompareLocations ? await getAnalyticsDashboard({ ...raw, organization: scoped.filters.organization, location: undefined }) : null;
  const orgAverage = organization?.overview?.average_normalized;
  return <div className="grid gap-7"><header><p className="text-sm font-bold text-brand">Location analytics</p><h1 className="mt-2 text-3xl font-bold">{location.name_en}</h1><p dir="rtl" className="text-muted">{location.name_ar}</p><p className="mt-2 text-sm text-muted">{scoped.range.from} – {scoped.range.to} · Asia/Kuwait</p></header><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Responses" value={String(scoped.overview.selected_responses)} /><MetricCard label="Normalized rating" value={scoped.overview.average_normalized === null ? "No data" : `${scoped.overview.average_normalized}%`} /><MetricCard label="Open alerts" value={String(scoped.overview.open_alert_count)} /><MetricCard label="Organization comparison" value={orgAverage === null || orgAverage === undefined || scoped.overview.average_normalized === null ? "Insufficient data" : `${(scoped.overview.average_normalized - orgAverage).toFixed(1)} pts`} detail={organization ? "Difference from permitted organization average" : "Restricted for location managers"} /></div>
    <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-3xl border border-border bg-white p-6"><h2 className="mb-5 text-xl font-bold">Response trend</h2><AccessibleBarChart title={`${location.name_en} response trend`} items={scoped.overview.response_trend.map((item) => ({ label: item.period, value: item.count }))} /></section><section className="rounded-3xl border border-border bg-white p-6"><h2 className="mb-5 text-xl font-bold">Rating distribution</h2><AccessibleBarChart title={`${location.name_en} rating distribution`} items={scoped.overview.rating_distribution.map((item) => ({ label: `${item.band * 20}–${item.band === 4 ? 100 : item.band * 20 + 19}%`, value: item.count }))} /></section></div>
    <section className="rounded-3xl border border-border bg-white p-6"><h2 className="text-xl font-bold">Active surveys</h2><div className="mt-4 grid gap-2">{scoped.surveys.filter((survey) => survey.status === "active" && survey.location_id === locationId).map((survey) => <Link key={survey.id} className="rounded-xl border border-border p-3 font-semibold text-brand" href={`/dashboard/surveys/${survey.id}/analytics`}>{survey.title_en}</Link>)}</div></section>
    <section className="rounded-3xl border border-border bg-white p-6"><h2 className="text-xl font-bold">Recent responses</h2><div className="mt-4 grid gap-3">{scoped.overview.recent_responses.map((response) => <Link key={response.id} href={`/dashboard/responses/${response.id}`} className="rounded-xl bg-background p-3 text-sm"><span className="font-semibold">{formatKuwaitDateTime(response.submitted_at)}</span> · {response.normalized_rating ?? "—"}%</Link>)}</div></section>
  </div>;
}
