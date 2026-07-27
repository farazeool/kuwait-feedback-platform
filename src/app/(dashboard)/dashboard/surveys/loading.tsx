import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function SurveyListLoading() {
  return (
    <div role="status" aria-label="Loading surveys" className="grid gap-6">
      <SkeletonHeader withAction />
      <SkeletonFilters fields={3} />
      <SkeletonTable rows={6} cols={5} />
      <span className="sr-only">Loading surveys…</span>
    </div>
  );
}
