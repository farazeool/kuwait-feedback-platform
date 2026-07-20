import Link from "next/link";

import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { getAnalyticsDashboard } from "@/features/analytics/server";

export default async function LocationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const result = await getAnalyticsDashboard(raw);
  const analytics = result.overview;
  return <div className="grid gap-7"><header><p className="text-sm font-bold text-brand">Branch intelligence</p><h1 className="mt-2 text-3xl font-bold">Locations</h1><p className="mt-2 text-muted">Exact response counts accompany every normalized average.</p></header><AnalyticsFilters values={{ ...raw, ...result.filters }} organizations={result.organizations} locations={result.locations} surveys={result.surveys} action="/dashboard/locations" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{analytics?.location_comparison.map((location) => <Link key={location.id} href={`/dashboard/locations/${location.id}?preset=${result.range.preset}`} className="rounded-3xl border border-border bg-white p-6 transition hover:border-brand"><h2 className="font-bold">{location.name_en}</h2><p dir="rtl" className="text-sm text-muted">{location.name_ar}</p><div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-sm text-muted">Normalized average</p><p className="text-2xl font-bold">{location.average_normalized === null ? "—" : `${location.average_normalized}%`}</p></div><p className="text-sm font-semibold">{location.response_count} responses</p></div>{!location.sufficient_data ? <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Insufficient data for ranking (minimum 5).</p> : null}</Link>)}</div>
    {!analytics?.location_comparison.length ? <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">No permitted locations.</p> : null}
  </div>;
}
