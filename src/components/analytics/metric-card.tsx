export function MetricCard({ label, value, detail, trend }: { label: string; value: string; detail?: string; trend?: { direction: "up" | "down" | "same"; label: string } }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {trend ? (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
            trend.direction === "up" ? "text-emerald-600" :
            trend.direction === "down" ? "text-red-600" :
            "text-muted"
          }`}>
            <svg viewBox="0 0 24 24" fill="none" className={`size-3.5 ${
              trend.direction === "up" ? "" :
              trend.direction === "down" ? "rotate-180" : ""
            }`}>
              <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {trend.label}
          </span>
        ) : null}
        {detail ? <span className="text-xs text-muted">{detail}</span> : null}
      </div>
    </section>
  );
}
