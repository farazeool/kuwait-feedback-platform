import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { canManageSurveyStructure } from "@/features/surveys/permissions";
import { listSurveyGroups } from "@/features/surveys/server";
import { formatKuwaitDateTime } from "@/lib/datetime/kuwait";

export default async function SurveysPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; location?: string }> }) {
  const filters = await searchParams;
  const { context, rows } = await listSurveyGroups(filters);
  const role = context.profile.platformRole ?? context.membership?.role ?? "analyst";
  return (
    <div className="grid gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold text-brand">Survey management</p><h1 className="mt-2 text-3xl font-bold">Surveys</h1></div>
        {canManageSurveyStructure(role) ? <Link className="rounded-xl bg-brand px-4 py-3 font-semibold text-white" href="/dashboard/surveys/new">New survey</Link> : null}
      </header>
      <form className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-4">
        <input className="rounded-xl border border-border px-3 py-2" name="q" defaultValue={filters.q} placeholder="Search titles" />
        <select className="rounded-xl border border-border px-3 py-2" name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="draft">Draft</option><option value="active">Published</option><option value="archived">Archived</option></select>
        <select className="rounded-xl border border-border px-3 py-2" name="location" defaultValue={filters.location ?? ""}><option value="">All locations</option>{context.locations.map((location) => <option key={location.id} value={location.id}>{location.nameEn}</option>)}</select>
        <button className="rounded-xl border border-border px-4 py-2 font-semibold">Filter</button>
      </form>
      {rows.length === 0 ? <EmptyState title="No matching surveys" description="Create a bilingual draft or adjust the current filters." /> : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className="bg-background text-muted"><tr><th className="p-4 text-start">Survey</th><th className="p-4 text-start">Status</th><th className="p-4 text-start">Organization / locations</th><th className="p-4 text-start">Questions</th><th className="p-4 text-start">Responses</th><th className="p-4 text-start">Updated</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-4"><Link className="font-bold text-brand hover:underline" href={`/dashboard/surveys/${row.id}`}>{row.titleEn}</Link><p dir="rtl" className="mt-1 text-muted">{row.titleAr}</p></td><td className="p-4"><span className="rounded-full bg-background px-3 py-1 font-semibold">{row.status === "active" ? "published" : row.status}</span></td><td className="p-4"><p>{row.organization?.name_en}</p><p className="mt-1 text-muted">{row.locations.map((location) => location?.name_en).join(", ")}</p></td><td className="p-4">{row.questionCount}</td><td className="p-4">{row.responseCount}</td><td className="p-4">{formatKuwaitDateTime(row.updatedAt)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
