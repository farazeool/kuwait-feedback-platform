import { uploadEvidence } from "@/features/evidence/actions";

const inputClass = "rounded-lg border border-border px-3 py-2 text-sm";
const textareaClass = `${inputClass} min-h-24`;

export default async function NewEvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;

  return (
    <div className="grid gap-6 max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Upload evidence</h1>
      </header>

      {params.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}

      <form action={uploadEvidence} className="grid gap-6 rounded-xl border border-border bg-white p-6">
        {params.entityId ? <input type="hidden" name="entityId" value={params.entityId} /> : null}
        {params.entityType ? <input type="hidden" name="entityType" value={params.entityType} /> : null}
        {params.returnTo ? <input type="hidden" name="returnTo" value={params.returnTo} /> : null}

        {!params.entityType && (
          <label className="grid gap-2 font-semibold">
            Entity type
            <select name="entityType" className={inputClass} defaultValue="corrective_action">
              <option value="corrective_action">Corrective action</option>
              <option value="investigation">Investigation</option>
              <option value="response">Response</option>
              <option value="alert">Alert</option>
            </select>
          </label>
        )}

        {!params.entityId && (
          <label className="grid gap-2 font-semibold">
            Entity ID (UUID)
            <input required name="entityId" className={inputClass} placeholder="UUID of the parent entity" />
          </label>
        )}

        <label className="grid gap-2 font-semibold">
          File name
          <input required name="fileName" className={inputClass} placeholder="e.g., photo_20240115_001.jpg" maxLength={255} />
        </label>

        <label className="grid gap-2 font-semibold">
          Storage path
          <input required name="storagePath" className={inputClass} placeholder="e.g., evidence/ca/123e4567/photo.jpg" maxLength={500} />
        </label>

        <label className="grid gap-2 font-semibold">
          File type
          <select name="fileType" defaultValue="photo" className={inputClass}>
            <option value="photo">Photo</option>
            <option value="pdf">PDF</option>
            <option value="checklist">Checklist</option>
            <option value="training_record">Training record</option>
            <option value="maintenance_record">Maintenance record</option>
            <option value="supplier_document">Supplier document</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="grid gap-2 font-semibold">
          Description (optional)
          <textarea name="description" className={textareaClass} placeholder="Description of the evidence..." maxLength={2000} />
        </label>

        <div className="pt-4 border-t border-border">
          <button className="rounded-lg bg-brand px-5 py-3 font-bold text-white">Upload evidence</button>
        </div>
      </form>
    </div>
  );
}