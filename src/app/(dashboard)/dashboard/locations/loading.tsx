import { Skeleton, SkeletonFilters, SkeletonHeader } from "@/components/ui/skeleton";

export default function LocationsLoading() {
  return (
    <div role="status" aria-label="Loading location analytics" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={4} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid gap-4 rounded-xl border border-border bg-white p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
            <div className="mt-1 flex items-end justify-between gap-3">
              <div className="grid gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-7 w-20" />
              </div>
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading location analytics…</span>
    </div>
  );
}
