import { SkeletonFilters, SkeletonHeader, SkeletonMetricCards, SkeletonTable } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div role="status" aria-label="Loading reports" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={4} />
      <SkeletonMetricCards count={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-xl border border-border bg-white p-5">
          <div className="h-full animate-pulse rounded-lg bg-border/60" />
        </div>
        <div className="h-72 rounded-xl border border-border bg-white p-5">
          <div className="h-full animate-pulse rounded-lg bg-border/60" />
        </div>
      </div>
      <SkeletonTable rows={6} cols={5} />
      <span className="sr-only">Loading reports…</span>
    </div>
  );
}