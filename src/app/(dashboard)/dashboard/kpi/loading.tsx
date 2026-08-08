import { SkeletonCard, SkeletonHeader, SkeletonMetricCards } from "@/components/ui/skeleton";

export default function KpiLoading() {
  return (
    <div role="status" aria-label="Loading KPI dashboard" className="grid gap-6">
      <SkeletonHeader />
      <SkeletonMetricCards count={4} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-80" />
      </div>
      <span className="sr-only">Loading KPI dashboard…</span>
    </div>
  );
}