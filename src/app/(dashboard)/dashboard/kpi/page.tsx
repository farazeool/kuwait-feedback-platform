import { AccessibleBarChart } from "@/components/analytics/bar-chart";
import { MetricCard } from "@/components/analytics/metric-card";
import { getKpiDashboard, type KpiFilters } from "@/features/kpi/server";
import { getMessages } from "@/lib/i18n/messages";

function FilterSelect({ name, defaultValue, label, options }: { name: string; defaultValue?: string; label: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} className="rounded-lg border border-border px-3 py-2 text-sm">
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default async function KpiDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters: KpiFilters = {
    startAt: params.startAt,
    endAt: params.endAt,
    locationId: params.locationId,
    surveyId: params.surveyId,
    departmentId: params.departmentId,
    touchpointId: params.touchpointId,
    channel: params.channel,
  };
  const result = await getKpiDashboard(filters);
  const m = getMessages(result.context.profile.locale);
  const kpi = result.data;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">KPI dashboard</h1>
        <p className="mt-1 text-sm text-muted">Organization-wide quality indicators for the selected period · Asia/Kuwait</p>
      </header>

      {/* Filter bar */}
      <form className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-3 xl:grid-cols-5">
        <FilterSelect
          name="startAt" defaultValue={params.startAt} label="Period start"
          options={[]}
        />
        <FilterSelect
          name="endAt" defaultValue={params.endAt} label="Period end"
          options={[]}
        />
        <FilterSelect
          name="locationId" defaultValue={params.locationId} label="Location"
          options={result.filters.locations.map((l) => ({ value: l.id, label: l.name_en }))}
        />
        <FilterSelect
          name="surveyId" defaultValue={params.surveyId} label="Survey"
          options={result.filters.surveys.map((s) => ({ value: s.id, label: s.title_en }))}
        />
        <FilterSelect
          name="departmentId" defaultValue={params.departmentId} label="Department"
          options={result.filters.departments.map((d) => ({ value: d.id, label: d.name_en }))}
        />
        <FilterSelect
          name="touchpointId" defaultValue={params.touchpointId} label="Touchpoint"
          options={result.filters.touchpoints.map((t) => ({ value: t.id, label: t.name_en }))}
        />
        <FilterSelect
          name="channel" defaultValue={params.channel} label="Channel"
          options={[
            { value: "qr", label: "QR" },
            { value: "kiosk", label: "Kiosk" },
            { value: "web", label: "Web" },
          ]}
        />
        <label className="grid gap-1 text-sm font-semibold">
          Custom start
          <input type="date" name="startAt" defaultValue={params.startAt?.slice(0, 10)} className="rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Custom end
          <input type="date" name="endAt" defaultValue={params.endAt?.slice(0, 10)} className="rounded-lg border border-border px-3 py-2 text-sm" />
        </label>
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white xl:col-span-5">Apply filters</button>
      </form>

      {!kpi ? (
        <p className="text-sm text-muted">No data available for the selected period and filters.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Responses" value={String(kpi.total_responses)} detail={`${kpi.rated_responses} rated`} />
            <MetricCard label="Satisfaction" value={kpi.satisfaction_pct === null ? "No data" : `${kpi.satisfaction_pct}%`} detail={`Rating ≥ ${kpi.satisfied_min}`} />
            <MetricCard label="Negative feedback" value={kpi.negative_feedback_pct === null ? "No data" : `${kpi.negative_feedback_pct}%`} detail={`Rating ≤ ${kpi.negative_max}`} />
            <MetricCard label="Average rating" value={kpi.average_rating === null ? "No data" : `${kpi.average_rating}`} detail="Overall average" />
            <MetricCard label="Top concerns" value={String(kpi.top_concerns.length)} detail="Primary concerns" />
            <MetricCard label="Prev. period satisfaction" value={kpi.prev_satisfaction_pct === null ? "No data" : `${kpi.prev_satisfaction_pct}%`} detail="Previous period comparison" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="grid gap-4 rounded-xl border border-border bg-white p-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Top concerns</h2>
                <p className="mt-0.5 text-xs text-muted">Most frequently raised primary concerns</p>
              </div>
              {kpi.top_concerns.length ? (
                <ul className="grid gap-2">
                  {kpi.top_concerns.map((item) => (
                    <li key={item.slug} className="flex items-center justify-between rounded-lg border border-border px-4 py-2">
                      <span className="text-sm font-medium">{result.context.profile.locale === "ar" ? item.name_ar : item.name_en}</span>
                      <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No concerns raised this period.</p>
              )}
            </section>
            <section className="grid gap-4 rounded-xl border border-border bg-white p-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Channel breakdown</h2>
                <p className="mt-0.5 text-xs text-muted">Response volume by collection channel</p>
              </div>
              {kpi.channel_breakdown.length ? (
                <AccessibleBarChart title="Channel breakdown" items={kpi.channel_breakdown.map((item) => ({ label: item.channel, value: item.count }))} />
              ) : (
                <p className="text-sm text-muted">No responses this period.</p>
              )}
            </section>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="grid gap-4 rounded-xl border border-border bg-white p-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Location KPIs</h2>
                <p className="mt-0.5 text-xs text-muted">Per-location response counts and ratings</p>
              </div>
              {kpi.location_kpis.length ? (
                <div className="grid gap-2">
                  {kpi.location_kpis.map((loc) => (
                    <div key={loc.id} className="rounded-lg border border-border px-4 py-3">
                      <p className="text-sm font-semibold">{loc.name_en}</p>
                      <p dir="rtl" className="text-xs text-muted">{loc.name_ar}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <span>{loc.response_count} responses</span>
                        <span>Avg: {loc.average_rating === null ? "—" : loc.average_rating}</span>
                        <span>Satisfaction: {loc.satisfaction_pct === null ? "—" : `${loc.satisfaction_pct}%`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No permitted locations.</p>
              )}
            </section>
            <section className="grid gap-4 rounded-xl border border-border bg-white p-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">Department KPIs</h2>
                <p className="mt-0.5 text-xs text-muted">Per-department response counts and ratings</p>
              </div>
              {kpi.department_kpis.length ? (
                <div className="grid gap-2">
                  {kpi.department_kpis.map((dept) => (
                    <div key={dept.id} className="rounded-lg border border-border px-4 py-3">
                      <p className="text-sm font-semibold">{dept.name_en}</p>
                      <p dir="rtl" className="text-xs text-muted">{dept.name_ar}</p>
                      <div className="mt-2 flex gap-4 text-sm">
                        <span>{dept.response_count} responses</span>
                        <span>Avg: {dept.average_rating === null ? "—" : dept.average_rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No departments.</p>
              )}
            </section>
          </div>
          <section className="grid gap-4 rounded-xl border border-border bg-white p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Response trend</h2>
              <p className="mt-0.5 text-xs text-muted">Daily response volume with satisfaction and negative markers</p>
            </div>
            {kpi.response_trend.length ? (
              <AccessibleBarChart title="Response trend" items={kpi.response_trend.map((item) => ({ label: item.period, value: item.count }))} />
            ) : (
              <p className="text-sm text-muted">No responses this period.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
