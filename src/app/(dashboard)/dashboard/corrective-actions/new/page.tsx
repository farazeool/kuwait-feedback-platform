import { createCorrectiveAction } from "@/features/corrective-actions/actions";
import { getFilterOptions } from "@/features/corrective-actions/server";
import { getMessages } from "@/lib/i18n/messages";

export default async function NewCorrectiveActionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const result = await getFilterOptions();
  const inputClass = "rounded-lg border border-border px-3 py-2 text-sm";
  const textareaClass = `${inputClass} min-h-24`;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">New corrective action</h1>

      {params.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}

      <form action={createCorrectiveAction} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        {params.sourceResponseId ? <input type="hidden" name="sourceResponseId" value={params.sourceResponseId} /> : null}
        {params.relatedAlertId ? <input type="hidden" name="relatedAlertId" value={params.relatedAlertId} /> : null}

        <label className="grid gap-2 font-semibold md:col-span-2">
          Problem <textarea required name="problem" className={textareaClass} placeholder="Describe the problem that requires corrective action" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Root cause <textarea required name="rootCause" className={textareaClass} placeholder="Identify the root cause of the problem" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Action description <textarea required name="actionDescription" className={textareaClass} placeholder="Describe the corrective action to be taken" />
        </label>

        <label className="grid gap-2 font-semibold">
          Priority
          <select name="priority" defaultValue="medium" className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          Assigned owner
          <select required name="assignedOwnerId" className={inputClass}>
            <option value="">Select...</option>
            {result.assignees.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>

        <label className="grid gap-2 font-semibold">
          Branch
          <select name="branchId" className={inputClass}>
            <option value="">None</option>
            {result.branches.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
          </select>
        </label>
        <label className="grid gap-2 font-semibold">
          Department
          <select name="departmentId" className={inputClass}>
            <option value="">None</option>
            {result.departments.map((d) => <option key={d.id} value={d.id}>{d.name_en}</option>)}
          </select>
        </label>

        <label className="grid gap-2 font-semibold">
          Due date <input required type="date" name="dueDate" className={inputClass} />
        </label>
        <label className="grid gap-2 font-semibold">
          Target completion date <input required type="date" name="targetCompletionDate" className={inputClass} />
        </label>

        <label className="grid gap-2 font-semibold md:col-span-2">
          Controlled record reference <input name="controlledRecordReference" placeholder="e.g. NCR-2026-0042" className={inputClass} />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Internal notes <textarea name="internalNotes" className={`${inputClass} min-h-20`} />
        </label>

        <div className="md:col-span-2"><button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">Create corrective action</button></div>
      </form>
    </div>
  );
}
