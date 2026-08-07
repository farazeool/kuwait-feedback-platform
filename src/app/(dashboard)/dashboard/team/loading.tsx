import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div role="status" aria-label="Loading team" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={3} />
      <SkeletonTable rows={6} cols={7} />
      <span className="sr-only">Loading team members…</span>
    </div>
  );
}
