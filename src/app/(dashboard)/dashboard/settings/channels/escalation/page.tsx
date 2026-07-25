import Link from "next/link";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { listEscalationRules } from "@/features/escalation/server";
import { toggleEscalationRule, deleteEscalationRule } from "@/features/escalation/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function EscalationPage() {
  const context = await requireOrganizationManagementContext();
  const { rules } = await listEscalationRules();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Channels</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Escalation Rules</h1>
          <p className="mt-1 text-sm text-muted">Configure smart escalation rules for automated alerts</p>
        </div>
        <Link
          href="/dashboard/settings/channels"
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium"
        >
          ← Back to Channels
        </Link>
      </header>

      {rules.length === 0 ? (
        <EmptyState
          icon="alerts"
          title="No escalation rules"
          description="Create escalation rules to automatically trigger alerts, investigations, and notifications based on feedback patterns."
        />
      ) : (
        <div className="grid gap-3">
          {rules.map((rule: Record<string, unknown>) => (
            <div key={rule.id as string} className="rounded-xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`grid size-2 rounded-full ${(rule.is_active as boolean) ? "bg-emerald-500" : "bg-muted"}`} />
                    <h3 className="font-semibold text-foreground">
                      {rule.trigger_type as string === "rating_threshold" ? "Rating threshold" :
                       rule.trigger_type as string === "keywords" ? "Keyword match" :
                       rule.trigger_type as string === "negative_sentiment" ? "Negative sentiment" :
                       rule.trigger_type as string}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      (rule.severity as string) === "critical" ? "bg-red-100 text-red-700" :
                      (rule.severity as string) === "high" ? "bg-orange-100 text-orange-700" :
                      (rule.severity as string) === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {(rule.severity as string)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                    {rule.threshold_value != null ? <span>Threshold: {rule.threshold_value as string}</span> : null}
                    {rule.auto_create_alert ? <span>Auto-alert</span> : null}
                    {rule.auto_assign_investigation ? <span>Auto-investigate</span> : null}
                    {rule.auto_notify_manager ? <span>Notify manager</span> : null}
                    <span>Created {formatKuwaitDateTime(rule.created_at as string)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={toggleEscalationRule}>
                    <input type="hidden" name="ruleId" value={rule.id as string} />
                    <input type="hidden" name="isActive" value={String(!(rule.is_active as boolean))} />
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
                      {(rule.is_active as boolean) ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={deleteEscalationRule}>
                    <input type="hidden" name="ruleId" value={rule.id as string} />
                    <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
