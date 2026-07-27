import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <div role="status" aria-label="Loading alerts" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={4} />
      <SkeletonTable rows={7} cols={6} />
      <span className="sr-only">Loading alerts…</span>
    </div>
  );
}
