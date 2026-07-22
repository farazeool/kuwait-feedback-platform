import { listAlertConfigurations } from "@/features/alerts/config/server";
import { saveAlertConfiguration } from "@/features/alerts/config/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function NewAlertConfigurationPage() {
  const result = await listAlertConfigurations();
  const m = getMessages(result.context.profile.locale);
  const input = "rounded-lg border border-border px-3 py-2 text-sm";
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">New alert configuration</h1>
      <form action={saveAlertConfiguration} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        <label className="grid gap-2 font-semibold">
          Rule type
          <select name="ruleType" className={input} defaultValue="satisfaction_threshold">
            <option value="satisfaction_threshold">Satisfaction threshold</option>
            <option value="negative_feedback_threshold">Negative feedback threshold</option>
            <option value="concern_frequency_threshold">Concern frequency threshold</option>
            <option value="sudden_decline">Sudden decline</option>
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          Threshold value
          <input type="number" name="thresholdValue" step="0.01" defaultValue={7} className={input} required />
        </label>
        <label className="grid gap-2 font-semibold">
          Severity
          <select name="severity" className={input} defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          Deduplication minutes
          <input type="number" name="deduplicationMinutes" step="1" defaultValue={60} className={input} />
        </label>
        <label className="grid gap-2 font-semibold">
          Evaluation window (hours)
          <input type="number" name="evaluationWindowHours" step="1" defaultValue={24} className={input} min="1" max="168" />
        </label>
        <label className="grid gap-2 font-semibold">
          Comparison window (days)
          <input type="number" name="comparisonWindowDays" step="1" defaultValue={7} className={input} min="1" max="30" />
        </label>
        <label className="grid gap-2 font-semibold">
          Minimum sample count
          <input type="number" name="minimumSampleCount" step="1" defaultValue={5} className={input} min="1" max="100" />
        </label>
        <label className="grid gap-2 font-semibold">
          Location
          <select name="locationId" className={input}>
            <option value="">All locations</option>
            {result.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {result.context.profile.locale === "ar" ? loc.name_ar : loc.name_en}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          Active
          <select name="isActive" className={input} defaultValue="true">
            <option value="true">Active</option>
            <option value="false">Paused</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">{m["common.save"]}</button>
        </div>
      </form>
    </div>
  );
}