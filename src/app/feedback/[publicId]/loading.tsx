import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <main role="status" aria-label="Loading survey" className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Progress bar */}
      <Skeleton className="h-2 w-full rounded-full" />
      {/* Branded header card */}
      <Skeleton className="h-44 rounded-3xl" />
      {/* Question cards */}
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      {/* Submit button */}
      <Skeleton className="h-[60px] rounded-2xl" />
      <span className="sr-only">Loading survey…</span>
    </main>
  );
}
