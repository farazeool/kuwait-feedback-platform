import Link from "next/link";

import { listInvestigations, getInvestigationFilterOptions } from "@/features/investigations/server";
import { getMessages } from "@/lib/i18n/messages";
import { formatKuwaitDate } from "@/lib/datetime/kuwait";

const controlClass = "rounded-lg border border-border px-3 py-2 text-sm";
const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-blue-100 text-blue-800",
  waiting_verification: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800",
};
const escalationColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-800",
  quality_manager: "bg-amber-100 text-amber-800",
  senior_management: "bg-orange-100 text-orange-800",
  platform_admin: "bg-red-100 text-red-800",
};

export default async function InvestigationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { context, rows, pageCount } = await listInvestigations({
    q: params.q,
    status: params.status,
    branchId: params.branchId,
    departmentId: params.departmentId,
    investigatorId: params.investigatorId,
    page: params.page ? Number(params.page) : 1,
  });
  const m = getMessages(context.profile.locale);
  const filterOptions = await getInvestigationFilterOptions();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Quality management</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{m["nav.investigations"]}</h1>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 font-semibold text-white" href="/dashboard/investigations/new">
          New investigation
        </Link>
      </header>

      {params.created ? <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Investigation created.</p> : null}
      {params.deleted ? <p className="rounded-xl bg-red-50 p-4 text-red-800">Investigation deleted.</p> : null}

      <form className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-3 xl:grid-cols-6">
        <input name="q" defaultValue={params.q} placeholder="Search title, findings..." className={controlClass} />
        <select name="status" defaultValue={params.status ?? ""} className={controlClass}>
          <option value="">All statuses</option>
          {["draft", "active", "waiting_verification", "closed"].map((s) => (
            <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select name="branchId" defaultValue={params.branchId ?? ""} className={controlClass}>
          <option value="">All branches</option>
          {filterOptions.branches.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
        </select>
        <select name="departmentId" defaultValue={params.departmentId ?? ""} className={controlClass}>
          <option value="">All departments</option>
          {filterOptions.departments.map((d) => <option key={d.id} value={d.id}>{d.name_en}</option>)}
        </select>
        <select name="investigatorId" defaultValue={params.investigatorId ?? ""} className={controlClass}>
          <option value="">All investigators</option>
          {filterOptions.investigators.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
        <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">Filter</button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center">
          <p className="text-base font-semibold text-foreground">No investigations yet</p>
          <p className="mt-1 text-sm text-muted">Create one to start tracking quality investigations.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start">ID</th>
                <th className="px-4 py-2.5 text-start">Title</th>
                <th className="px-4 py-2.5 text-start">Status</th>
                <th className="px-4 py-2.5 text-start">Escalation</th>
                <th className="px-4 py-2.5 text-start">Branch</th>
                <th className="px-4 py-2.5 text-start">Investigated</th>
                <th className="px-4 py-2.5 text-start">Investigator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <Link className="font-semibold text-brand hover:underline" href={`/dashboard/investigations/${inv.id}`}>
                      {inv.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="max-w-60 truncate px-4 py-2.5">{inv.title}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[inv.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {inv.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${escalationColors[inv.escalation_decision] ?? "bg-gray-100 text-gray-800"}`}>
                      {inv.escalation_decision.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{inv.branch?.name_en ?? "—"}</td>
                  <td className="px-4 py-2.5">{formatKuwaitDate(inv.investigated_at)}</td>
                  <td className="px-4 py-2.5">{inv.investigator?.display_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Investigation pages" className="flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              className={`rounded-lg border px-3 py-2 ${page === Number(params.page ?? 1) ? "border-brand text-brand" : "border-border"}`}
              href={{ pathname: "/dashboard/investigations", query: { ...params, page } }}
            >
              {page}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}