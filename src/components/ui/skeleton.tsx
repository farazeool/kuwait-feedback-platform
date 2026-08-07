/**
 * Reusable skeleton loaders for Suspense/loading boundaries.
 *
 * Server components (no client JS) built from the existing Tailwind tokens so
 * that loading states mirror the real page layout and avoid layout shift when
 * data resolves. Pulse animation is disabled under `prefers-reduced-motion`
 * via the global rule in `globals.css`.
 */

/** Base shimmer block. Compose with layout wrappers below. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-border/70 ${className}`} />;
}

/** Stacked text lines; the last line is shortened to look like real copy. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`grid gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-3.5 ${index === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** The eyebrow + title header used at the top of every dashboard page. */
export function SkeletonHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      {withAction ? <Skeleton className="h-11 w-36 rounded-lg" /> : null}
    </div>
  );
}

/** Filter/search bar card that precedes most list pages. */
export function SkeletonFilters({ fields = 4 }: { fields?: number }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
      {Array.from({ length: fields }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** A single rounded content card, sized by className. */
export function SkeletonCard({ className = "h-32" }: { className?: string }) {
  return <Skeleton className={`rounded-3xl ${className}`} />;
}

/** Responsive grid of metric cards matching MetricCard styling. */
export function SkeletonMetricCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-xl border border-border bg-white p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Table skeleton mirroring the list-page table (header row + body rows). */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex gap-4 border-b border-border bg-surface-muted px-4 py-3">
        {Array.from({ length: cols }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      <div className="grid">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 border-t border-border px-4 py-3.5 first:border-t-0">
            {Array.from({ length: cols }, (_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
