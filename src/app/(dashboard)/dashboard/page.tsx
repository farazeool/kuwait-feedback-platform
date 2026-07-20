import { EmptyState } from "@/components/dashboard/empty-state";
import { requireAppAccessContext } from "@/lib/auth/context";

export default async function DashboardPage() {
  const context = await requireAppAccessContext();
  return (
    <div className="grid gap-7">
      <header>
        <p className="text-sm font-bold text-brand">Overview</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Organization summary</h1>
        <p className="mt-2 text-muted">Initial tenant and location context. Analytics arrive in a later milestone.</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-3">
        <SummaryCard label="Permitted locations" value={String(context.locations.length)} />
        <SummaryCard label="Organization" value={context.organization?.nameEn ?? "Platform"} />
        <SummaryCard label="Timezone" value="Asia/Kuwait" />
      </div>
      <EmptyState
        title="Analytics are not enabled yet"
        description="Response totals, ratings, trends, low-score alerts, and branch comparisons will be added after the secure survey-management workflow."
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-3xl border border-border bg-white p-6">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 truncate text-2xl font-bold">{value}</p>
    </section>
  );
}
