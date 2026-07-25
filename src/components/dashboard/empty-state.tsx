const emptyIllustrations: Record<string, React.ReactNode> = {
  responses: (
    <svg viewBox="0 0 40 40" fill="none" className="size-10 opacity-40">
      <rect x="4" y="6" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 16h16M12 22h12M12 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  surveys: (
    <svg viewBox="0 0 40 40" fill="none" className="size-10 opacity-40">
      <rect x="4" y="4" width="32" height="32" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 20l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  team: (
    <svg viewBox="0 0 40 40" fill="none" className="size-10 opacity-40">
      <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 34c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="28" cy="16" r="4" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2"/>
      <path d="M38 32c0-4-3-7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2"/>
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 40 40" fill="none" className="size-10 opacity-40">
      <path d="M20 6c-7 0-12 5-12 12v7l-3 4h30l-3-4v-7c0-7-5-12-12-12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M23 31a3 3 0 0 1-6 0" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="24" r="1" fill="currentColor"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 40 40" fill="none" className="size-10 opacity-40">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 20l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: "responses" | "surveys" | "team" | "alerts";
  action?: { label: string; href: string };
}) {
  const illustration = icon ? emptyIllustrations[icon] : emptyIllustrations.default;
  return (
    <section className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-surface-muted text-muted">
        {illustration}
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action ? (
        <a
          href={action.href}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}
