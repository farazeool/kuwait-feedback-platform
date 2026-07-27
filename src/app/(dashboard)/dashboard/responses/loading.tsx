import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function ResponseLoading() {
  return (
    <div role="status" aria-label="Loading responses" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={6} />
      <SkeletonTable rows={8} cols={7} />
      <span className="sr-only">Loading responses…</span>
    </div>
  );
}
