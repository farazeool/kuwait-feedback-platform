import { SkeletonFilters, SkeletonHeader, SkeletonMetricCards } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={4} />
      <SkeletonMetricCards count={5} />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-xl border border-border bg-white p-5">
          <div className="h-full animate-pulse rounded-lg bg-border/60" />
        </div>
        <div className="h-72 rounded-xl border border-border bg-white p-5">
          <div className="h-full animate-pulse rounded-lg bg-border/60" />
        </div>
      </div>
      <span className="sr-only">Loading dashboard analytics…</span>
    </div>
  );
}
