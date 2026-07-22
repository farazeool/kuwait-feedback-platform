import Link from "next/link";

import { listCorrectiveActions, getFilterOptions } from "@/features/corrective-actions/server";
import { getMessages } from "@/lib/i18n/messages";
import { formatKuwaitDateTime as formatKuwaitDate } from "@/lib/datetime/kuwait";

const controlClass = "rounded-lg border border-border px-3 py-2 text-sm";
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  pending_verification: "bg-purple-100 text-purple-800",
  verified: "bg-emerald-100 text-emerald-800",
  effectiveness_review: "bg-teal-100 text-teal-800",
  closed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const priorityColors: Record<string, string> = {
  low: "text-gray-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

export default async function CorrectiveActionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { context, rows, pageCount } = await listCorrectiveActions({
    q: params.q,
    status: params.status,
    priority: params.priority,
    branchId: params.branchId,
    departmentId: params.departmentId,
    assignedOwnerId: params.assignedOwnerId,
    dueDateFrom: params.dueDateFrom,
    dueDateTo: params.dueDateTo,
    page: params.page ? Number(params.page) : 1,
  });
  const m = getMessages(context.profile.locale);
  const filterOptions = await getFilterOptions();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Corrective Actions</h1>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 font-semibold text-white" href="/dashboard/corrective-actions/new">
          New corrective action
        </Link>
      </header>

      {params.created ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Corrective action created.</p> : null}
      {params.deleted ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Corrective action deleted.</p> : null}

      <form className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-3 xl:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="Search problem, root cause..." className={controlClass} />
        <select name="status" defaultValue={params.status ?? ""} className={controlClass}>
          <option value="">All statuses</option>
          {["draft", "open", "in_progress", "pending_verification", "verified", "effectiveness_review", "closed", "rejected"].map((s) => (
            <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select name="priority" defaultValue={params.priority ?? ""} className={controlClass}>
          <option value="">All priorities</option>
          {["low", "medium", "high", "critical"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select name="branchId" defaultValue={params.branchId ?? ""} className={controlClass}>
          <option value="">All branches</option>
          {filterOptions.branches.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">Filter</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <p className="text-base font-semibold text-foreground">No corrective actions yet</p>
          <p className="mt-1 text-sm text-muted">Create one to start tracking quality improvements.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start">ID</th>
                <th className="px-4 py-2.5 text-start">Problem</th>
                <th className="px-4 py-2.5 text-start">Priority</th>
                <th className="px-4 py-2.5 text-start">Status</th>
                <th className="px-4 py-2.5 text-start">Branch</th>
                <th className="px-4 py-2.5 text-start">Due date</th>
                <th className="px-4 py-2.5 text-start">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((action) => (
                <tr key={action.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <Link className="font-semibold text-brand hover:underline" href={`/dashboard/corrective-actions/${action.id}`}>
                      {action.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="max-w-60 truncate px-4 py-2.5">{action.problem}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold capitalize ${priorityColors[action.priority] ?? ""}`}>{action.priority}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[action.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {action.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{action.branch?.name_en ?? "—"}</td>
                  <td className="px-4 py-2.5">{formatKuwaitDate(action.due_date)}</td>
                  <td className="px-4 py-2.5">{action.assigned_owner?.display_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Corrective action pages" className="flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              className={`rounded-lg border px-3 py-2 ${page === Number(params.page ?? 1) ? "border-brand text-brand" : "border-border"}`}
              href={{ pathname: "/dashboard/corrective-actions", query: { ...params, page } }}
            >
              {page}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
