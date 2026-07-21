export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-1.5 text-xs text-muted">{detail}</p> : null}
    </section>
  );
}
