import { SkeletonCard, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function KiosksLoading() {
  return (
    <div role="status" aria-label="Loading kiosks" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonCard className="h-28" />
      <SkeletonTable rows={6} cols={6} />
      <span className="sr-only">Loading kiosks…</span>
    </div>
  );
}