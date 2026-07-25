import Link from "next/link";
import { deleteEvidence } from "@/features/evidence/actions";
import { listEvidence, getFilterOptions } from "@/features/evidence/server";
import { getMessages, type Locale } from "@/lib/i18n/messages";
import { formatKuwaitDate, formatKuwaitDateTime } from "@/lib/datetime/kuwait";
import type { EvidenceEntityType, EvidenceFileType, VerificationStatus } from "@/features/evidence/schema";

const controlClass = "rounded-lg border border-border px-3 py-2 text-sm";
const statusColors: Record<VerificationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  more_evidence_required: "bg-purple-100 text-purple-800",
};

const entityTypeColors: Record<EvidenceEntityType, string> = {
  corrective_action: "bg-blue-100 text-blue-800",
  investigation: "bg-amber-100 text-amber-800",
  response: "bg-teal-100 text-teal-800",
  alert: "bg-red-100 text-red-800",
};

const fileTypeColors: Record<EvidenceFileType, string> = {
  photo: "bg-green-100 text-green-800",
  pdf: "bg-red-100 text-red-800",
  checklist: "bg-blue-100 text-blue-800",
  training_record: "bg-purple-100 text-purple-800",
  maintenance_record: "bg-orange-100 text-orange-800",
  supplier_document: "bg-indigo-100 text-indigo-800",
  other: "bg-gray-100 text-gray-800",
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FileTypeBadge({ type }: { type: EvidenceFileType }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fileTypeColors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: EvidenceEntityType }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entityTypeColors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

export default async function EvidenceListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { context, rows, pageCount, totalCount } = await listEvidence({
    q: params.q,
    entityType: params.entityType,
    entityId: params.entityId,
    fileType: params.fileType,
    verificationStatus: params.verificationStatus,
    uploadedBy: params.uploadedBy,
    uploadedFrom: params.uploadedFrom,
    uploadedTo: params.uploadedTo,
    page: params.page ? Number(params.page) : 1,
  });
  const m = getMessages(context.profile.locale as Locale);
  const filterOptions = await getFilterOptions();

  const canManage = context.profile.platformRole === "platform_admin" ||
    ["organization_owner", "organization_admin", "quality_manager", "location_manager"].includes(context.membership?.role ?? "");

  const page = params.page ? Number(params.page) : 1;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Evidence</h1>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 font-semibold text-white" href="/dashboard/evidence/new">
          Upload evidence
        </Link>
      </header>

      {params.created ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Evidence uploaded.</p> : null}
      {params.deleted ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Evidence deleted.</p> : null}
      {params.error === "upload_failed" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Failed to upload evidence.</p> : null}
      {params.error === "delete_failed" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Failed to delete evidence.</p> : null}
      {params.error === "validation" ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Please check all required fields.</p> : null}

      <form className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <input name="q" defaultValue={params.q} placeholder="Search file name, description..." className={controlClass} />
        <select name="entityType" defaultValue={params.entityType ?? ""} className={controlClass}>
          <option value="">All entity types</option>
          <option value="corrective_action">Corrective action</option>
          <option value="investigation">Investigation</option>
          <option value="response">Response</option>
          <option value="alert">Alert</option>
        </select>
        <select name="fileType" defaultValue={params.fileType ?? ""} className={controlClass}>
          <option value="">All file types</option>
          <option value="photo">Photo</option>
          <option value="pdf">PDF</option>
          <option value="checklist">Checklist</option>
          <option value="training_record">Training record</option>
          <option value="maintenance_record">Maintenance record</option>
          <option value="supplier_document">Supplier document</option>
          <option value="other">Other</option>
        </select>
        <select name="verificationStatus" defaultValue={params.verificationStatus ?? ""} className={controlClass}>
          <option value="">All verification statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="more_evidence_required">More evidence required</option>
        </select>
        <div className="flex gap-2">
          <select name="page" defaultValue={params.page ?? "1"} className={`${controlClass} flex-1`}>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>Page {p}</option>
            ))}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Filter</button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">File</th>
              <th className="px-4 py-2.5 text-start">Type</th>
              <th className="px-4 py-2.5 text-start">Entity</th>
              <th className="px-4 py-2.5 text-start">Verification</th>
              <th className="px-4 py-2.5 text-start">Uploaded by</th>
              <th className="px-4 py-2.5 text-start">Date</th>
              <th className="px-4 py-2.5 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={7}>No evidence found.</td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <Link className="font-medium text-brand hover:underline" href={`/dashboard/evidence/${e.id}`}>
                      {e.file_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><FileTypeBadge type={e.file_type} /></td>
                  <td className="px-4 py-2.5">
                    <EntityTypeBadge type={e.entity_type} />
                    <span className="ml-2 text-xs text-muted">{e.entity_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={e.verification_status} /></td>
                  <td className="px-4 py-2.5">{e.uploader?.display_name ?? "—"}</td>
                  <td className="px-4 py-2.5">{formatKuwaitDateTime(e.uploaded_at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {canManage && (
                        <form action={deleteEvidence} className="inline">
                          <input type="hidden" name="evidenceId" value={e.id} />
                          <button className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link className="rounded-lg border border-border px-3 py-2 text-sm" href={`/dashboard/evidence?page=${page - 1}&q=${params.q ?? ""}&entityType=${params.entityType ?? ""}&fileType=${params.fileType ?? ""}&verificationStatus=${params.verificationStatus ?? ""}`}>
              Previous
            </Link>
          )}
          <span className="text-sm text-muted">Page {page} of {pageCount} ({totalCount} total)</span>
          {page < pageCount && (
            <Link className="rounded-lg border border-border px-3 py-2 text-sm" href={`/dashboard/evidence?page=${page + 1}&q=${params.q ?? ""}&entityType=${params.entityType ?? ""}&fileType=${params.fileType ?? ""}&verificationStatus=${params.verificationStatus ?? ""}`}>
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}