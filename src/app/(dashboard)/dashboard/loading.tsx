export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="grid animate-pulse gap-5">
      <div className="h-10 w-64 rounded-xl bg-border" />
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="h-32 rounded-3xl bg-border" />
        <div className="h-32 rounded-3xl bg-border" />
        <div className="h-32 rounded-3xl bg-border" />
      </div>
    </div>
  );
}
