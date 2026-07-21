import Link from "next/link";

import { archiveSurvey, duplicateSurvey, publishSurvey } from "@/features/surveys/actions";
import { canManageSurveyStructure } from "@/features/surveys/permissions";
import { getSurveyEditor } from "@/features/surveys/server";
import { requireAppAccessContext } from "@/lib/auth/context";

export default async function SurveyDetailPage({ params, searchParams }: { params: Promise<{ surveyId: string }>; searchParams: Promise<{ error?: string; published?: string; archived?: string; saved?: string }> }) {
  const [{ surveyId }, notice, context] = await Promise.all([params, searchParams, requireAppAccessContext()]);
  const survey = await getSurveyEditor(surveyId);
  const role = context.profile.platformRole ?? context.membership?.role ?? "analyst";
  const canManage = canManageSurveyStructure(role);
  return <div className="grid gap-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">{survey.status === "active" ? "Published" : survey.status}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{survey.draft.titleEn}</h1><p className="mt-1 text-muted" dir="rtl">{survey.draft.titleAr}</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-border bg-white px-4 py-2 font-medium" href={`/dashboard/surveys/${surveyId}/analytics`}>Analytics</Link><Link className="rounded-lg border border-border bg-white px-4 py-2 font-medium" href={`/dashboard/surveys/${surveyId}/distribution`}>Distribution</Link>{canManage && survey.status === "draft" ? <Link className="rounded-lg border border-border bg-white px-4 py-2 font-medium" href={`/dashboard/surveys/${surveyId}/edit`}>Edit</Link> : null}</div></header>
    {notice.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">The requested survey operation could not be completed safely.</p> : null}
    {notice.published || notice.archived || notice.saved ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Survey state updated successfully.</p> : null}
    <section className="grid gap-4 rounded-xl border border-border bg-white p-6 sm:grid-cols-3"><div><p className="text-sm text-muted">Locations</p><p className="mt-2 text-2xl font-bold">{survey.draft.locationIds.length}</p></div><div><p className="text-sm text-muted">Questions</p><p className="mt-2 text-2xl font-bold">{survey.draft.questions.length}</p></div><div><p className="text-sm text-muted">Responses</p><p className="mt-2 text-2xl font-bold">{survey.responseCount}</p></div></section>
    {canManage ? <div className="flex flex-wrap gap-3">{survey.status === "draft" || survey.status === "archived" ? <form action={publishSurvey}><input type="hidden" name="surveyId" value={surveyId} /><button className="rounded-lg bg-brand px-4 py-3 font-semibold text-white">{survey.status === "archived" ? "Restore and publish" : "Publish"}</button></form> : null}{survey.status === "active" ? <form action={archiveSurvey}><input type="hidden" name="surveyId" value={surveyId} /><button className="rounded-lg border border-border bg-white px-4 py-3 font-medium">Archive</button></form> : null}<form action={duplicateSurvey}><input type="hidden" name="surveyId" value={surveyId} /><button className="rounded-lg border border-border bg-white px-4 py-3 font-medium">Duplicate to draft</button></form></div> : <p className="rounded-xl bg-background p-4 text-sm text-muted">Your role has read-only survey access.</p>}
  </div>;
}
