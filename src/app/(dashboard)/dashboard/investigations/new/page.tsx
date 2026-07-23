import { createInvestigation } from "@/features/investigations/actions";
import { getInvestigationFilterOptions } from "@/features/investigations/server";

const inputClass = "rounded-lg border border-border px-3 py-2 text-sm";
const textareaClass = `${inputClass} min-h-24`;

export default async function NewInvestigationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const result = await getInvestigationFilterOptions();

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">New Investigation</h1>

      {params.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}

      <form action={createInvestigation} className="grid gap-4 rounded-xl border border-border bg-white p-6 md:grid-cols-2">
        <label className="grid gap-2 font-semibold md:col-span-2">
          Title <input required name="title" className={inputClass} placeholder="Investigation title" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Description <textarea name="description" className={textareaClass} placeholder="Describe the investigation scope" />
        </label>

        <label className="grid gap-2 font-semibold">
          Branch
          <select required name="branchId" className={inputClass}>
            <option value="">Select branch...</option>
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
          Investigation date
          <input required type="date" name="investigatedAt" className={inputClass} />
        </label>
        <label className="grid gap-2 font-semibold">
          Investigator
          <select required name="investigatorId" className={inputClass}>
            <option value="">Select investigator...</option>
            {result.investigators.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>

        <label className="grid gap-2 font-semibold md:col-span-2">
          Evidence reviewed <textarea name="evidenceReviewed" className={textareaClass} placeholder="Describe evidence reviewed" />
        </label>

        <label className="flex items-center gap-3 font-semibold md:col-span-2">
          <input type="checkbox" name="repeatedComplaints" value="true" className="h-4 w-4 rounded border-border" />
          Repeated complaints about this product/location
        </label>

        <label className="grid gap-2 font-semibold md:col-span-2">
          Root cause <textarea name="rootCause" className={textareaClass} placeholder="Identify the root cause" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Findings <textarea name="findings" className={textareaClass} placeholder="Key findings from the investigation" />
        </label>
        <label className="grid gap-2 font-semibold md:col-span-2">
          Recommendation <textarea name="recommendation" className={textareaClass} placeholder="Recommended actions" />
        </label>

        <label className="grid gap-2 font-semibold">
          Escalation decision
          <select name="escalationDecision" defaultValue="none" className={inputClass}>
            <option value="none">No escalation</option>
            <option value="quality_manager">Quality manager</option>
            <option value="senior_management">Senior management</option>
            <option value="platform_admin">Platform admin</option>
          </select>
        </label>

        <label className="grid gap-2 font-semibold md:col-span-2">
          Internal notes <textarea name="internalNotes" className={`${inputClass} min-h-20`} />
        </label>

        <div className="md:col-span-2"><button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">Create investigation</button></div>
      </form>
    </div>
  );
}