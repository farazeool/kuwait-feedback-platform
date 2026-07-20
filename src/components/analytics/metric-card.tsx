export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <section className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p>{detail ? <p className="mt-2 text-xs text-muted">{detail}</p> : null}</section>;
}
