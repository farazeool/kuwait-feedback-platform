import Link from "next/link";

import { listTouchpoints } from "@/features/touchpoints/server";
import { deleteTouchpoint } from "@/features/touchpoints/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function TouchpointsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const result = await listTouchpoints();
  const m = getMessages(result.context.profile.locale);
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Feedback collection</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{m["settings.touchpoints"]}</h1>
        </div>
        <Link href="/dashboard/settings/touchpoints/new" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">New touchpoint</Link>
      </header>
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4">Touchpoint updated.</p> : null}
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4">Touchpoint created.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4">Touchpoint deleted.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4">{m["common.error"]}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">Name (EN)</th>
              <th className="px-4 py-2.5 text-start">Name (AR)</th>
              <th className="px-4 py-2.5 text-start">Channel</th>
              <th className="px-4 py-2.5 text-start">Location</th>
              <th className="px-4 py-2.5 text-start">Department</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/settings/touchpoints/${row.id}`} className="font-semibold text-brand">{row.name_en}</Link>
                </td>
                <td className="px-4 py-2.5" dir="rtl">{row.name_ar}</td>
                <td className="px-4 py-2.5">{row.channel}</td>
                <td className="px-4 py-2.5">{row.locations?.name_en ?? "—"}</td>
                <td className="px-4 py-2.5">{row.departments?.name_en ?? "—"}</td>
                <td className="px-4 py-2.5">{row.status}</td>
                <td className="px-4 py-2.5">
                  <form action={deleteTouchpoint}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:border-red-400">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">No touchpoints yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
