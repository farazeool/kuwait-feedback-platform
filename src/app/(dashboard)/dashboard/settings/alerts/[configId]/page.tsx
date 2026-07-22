import { saveAlertConfiguration } from "@/features/alerts/config/actions";
import { listAlertConfigurations } from "@/features/alerts/config/server";
import { getMessages } from "@/lib/i18n/messages";

interface Props {
  params: Promise<{ configId?: string }>;
}

export default async function AlertConfigFormPage({ params }: Props) {
  const { configId } = await params;
  const result = await listAlertConfigurations();
  const m = getMessages(result.context.profile.locale);
  const existing = configId ? result.rows.find((row) => row.id === configId) : null;
  if (configId && !existing) return <p className="text-sm text-muted">Configuration not found.</p>;
  const input = "rounded-lg border border-border px-3 py-2 text-sm";
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{existing ? "Edit configuration" : "New alert configuration"}</h1>
      <form action={saveAlertConfiguration} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
        <label className="grid gap-2 font-semibold">Rule type<select name="ruleType" defaultValue={existing?.rule_type ?? "satisfaction_threshold"} className={input}><option value="satisfaction_threshold">Satisfaction threshold</option><option value="negative_feedback_threshold">Negative feedback threshold</option><option value="concern_frequency_threshold">Concern frequency threshold</option><option value="sudden_decline">Sudden decline</option></select></label>
        <label className="grid gap-2 font-semibold">Threshold value<input type="number" name="thresholdValue" step="0.01" defaultValue={existing?.threshold_value ?? 7} className={input} required /></label>
        <label className="grid gap-2 font-semibold">Severity<select name="severity" defaultValue={existing?.severity ?? "medium"} className={input}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label className="grid gap-2 font-semibold">Deduplication minutes<input type="number" name="deduplicationMinutes" step="1" defaultValue={existing?.deduplication_minutes ?? 60} className={input} /></label>
        <label className="grid gap-2 font-semibold">Location<select name="locationId" defaultValue={existing?.location_id ?? ""} className={input}><option value="">All locations</option>{result.locations.map((loc) => <option key={loc.id} value={loc.id}>{result.context.profile.locale === "ar" ? loc.name_ar : loc.name_en}</option>)}</select></label>
        <label className="grid gap-2 font-semibold">Active<select name="isActive" defaultValue={existing ? (existing.is_active ? "true" : "false") : "true"} className={input}><option value="true">Active</option><option value="false">Paused</option></select></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">{m["common.save"]}</button></div>
      </form>
    </div>
  );
}
