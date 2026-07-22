import Link from "next/link";

import { listRatingScales } from "@/features/rating-scales/server";
import { deleteRatingScale } from "@/features/rating-scales/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function RatingScalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const result = await listRatingScales();
  const m = getMessages(result.context.profile.locale);
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Survey configuration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{m["settings.ratingScales"]}</h1>
        </div>
        <Link href="/dashboard/settings/rating-scales/new" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">New scale</Link>
      </header>
      {notice.updated ? <p className="rounded-xl bg-emerald-50 p-4">Scale updated.</p> : null}
      {notice.created ? <p className="rounded-xl bg-emerald-50 p-4">Scale created.</p> : null}
      {notice.deleted ? <p className="rounded-xl bg-emerald-50 p-4">Scale deleted.</p> : null}
      {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4">{m["common.error"]}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start">Key</th>
              <th className="px-4 py-2.5 text-start">Name (EN)</th>
              <th className="px-4 py-2.5 text-start">Name (AR)</th>
              <th className="px-4 py-2.5 text-start">Range</th>
              <th className="px-4 py-2.5 text-start">Satisfied min</th>
              <th className="px-4 py-2.5 text-start">Negative max</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.key} className="border-t border-border transition-colors hover:bg-surface-muted">
                <td className="px-4 py-2.5 font-mono text-xs">{row.key}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/settings/rating-scales/${row.key}`} className="font-semibold text-brand">{row.name_en}</Link>
                </td>
                <td className="px-4 py-2.5" dir="rtl">{row.name_ar}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.scale_min}–{row.scale_max}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.satisfied_min}</td>
                <td className="px-4 py-2.5 tabular-nums">{row.negative_max}</td>
                <td className="px-4 py-2.5">{row.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-2.5">
                  <form action={deleteRatingScale}>
                    <input type="hidden" name="key" value={row.key} />
                    <button className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:border-red-400">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">No rating scales yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
