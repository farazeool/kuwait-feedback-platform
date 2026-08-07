type BarItem = { label: string; value: number; detail?: string };

export function AccessibleBarChart({ title, items, suffix = "" }: { title: string; items: BarItem[]; suffix?: string }) {
  const maximum = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">No data in this period.</div>;
  return (
    <figure className="grid gap-3" aria-label={title}>
      <figcaption className="sr-only">{title}: {items.map((item) => `${item.label}, ${item.value}${suffix}`).join("; ")}</figcaption>
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(5rem,0.8fr)_2fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted" title={item.label}>{item.label}</span>
          <div className="h-2.5 overflow-hidden rounded bg-background" aria-hidden="true">
            <div className="h-full rounded bg-brand transition-all" style={{ width: `${Math.max(item.value > 0 ? 2 : 0, item.value / maximum * 100)}%` }} />
          </div>
          <span className="min-w-10 text-end font-semibold tabular-nums" title={item.detail}>{item.value}{suffix}</span>
        </div>
      ))}
    </figure>
  );
}
