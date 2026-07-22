import Link from "next/link";

import { listDepartments } from "@/features/departments/server";
import { deleteDepartment } from "@/features/departments/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const result = await listDepartments();
  const m = getMessages(result.context.profile.locale);
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Organization structure</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{m["settings.departments"]}</h1>
        </div>
        <Link href="/dashboard/settings/departments/new" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">New department</Link>
      </header>
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4">Department updated.</p> : null}
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4">Department created.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4">Department deleted.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4">{m["common.error"]}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">Name (EN)</th>
              <th className="px-4 py-2.5 text-start">Name (AR)</th>
              <th className="px-4 py-2.5 text-start">Location</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/settings/departments/${row.id}`} className="font-semibold text-brand">{row.name_en}</Link>
                </td>
                <td className="px-4 py-2.5" dir="rtl">{row.name_ar}</td>
                <td className="px-4 py-2.5">{result.locations.find((l) => l.id === row.location_id)?.name_en ?? "—"}</td>
                <td className="px-4 py-2.5">{row.status}</td>
                <td className="px-4 py-2.5">
                  <form action={deleteDepartment}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:border-red-400">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No departments yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
