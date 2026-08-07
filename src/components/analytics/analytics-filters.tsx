type Option = { id: string; name_en?: string; title_en?: string };

const control = "min-h-9 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";

export function AnalyticsFilters({ values, organizations, locations, surveys, action = "/dashboard" }: {
  values: Record<string, string | number | undefined>;
  organizations: Option[];
  locations: Option[];
  surveys: Option[];
  action?: string;
}) {
  return (
    <form action={action} className="grid gap-2.5 rounded-xl border border-border bg-white p-4 md:grid-cols-4 xl:grid-cols-7">
      <label className="grid gap-1 text-xs font-medium text-muted">Date range<select className={control} name="preset" defaultValue={String(values.preset ?? "30d")}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="this_month">This month</option><option value="previous_month">Previous month</option><option value="custom">Custom</option></select></label>
      <label className="grid gap-1 text-xs font-medium text-muted">From<input className={control} type="date" name="from" defaultValue={String(values.from ?? "")} /></label>
      <label className="grid gap-1 text-xs font-medium text-muted">To<input className={control} type="date" name="to" defaultValue={String(values.to ?? "")} /></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Organization<select className={control} name="organization" defaultValue={String(values.organization ?? "")}><option value="">Current organization</option>{organizations.map((row) => <option key={row.id} value={row.id}>{row.name_en}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Location<select className={control} name="location" defaultValue={String(values.location ?? "")}><option value="">All permitted</option>{locations.map((row) => <option key={row.id} value={row.id}>{row.name_en}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Survey<select className={control} name="survey" defaultValue={String(values.survey ?? "")}><option value="">All surveys</option>{surveys.map((row) => <option key={row.id} value={row.id}>{row.title_en}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Alert status<select className={control} name="alertStatus" defaultValue={String(values.alertStatus ?? "")}><option value="">Any</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Minimum rating<input className={control} type="number" min="0" max="10" step="1" name="ratingMin" defaultValue={values.ratingMin} /></label>
      <label className="grid gap-1 text-xs font-medium text-muted">Maximum rating<input className={control} type="number" min="0" max="10" step="1" name="ratingMax" defaultValue={values.ratingMax} /></label>
      <button className="self-end rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Apply filters</button>
    </form>
  );
}
