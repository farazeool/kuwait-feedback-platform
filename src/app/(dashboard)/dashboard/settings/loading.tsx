import { Skeleton, SkeletonHeader } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div role="status" aria-label="Loading settings" className="grid gap-6">
      <SkeletonHeader />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border bg-white p-6">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading settings…</span>
    </div>
  );
}