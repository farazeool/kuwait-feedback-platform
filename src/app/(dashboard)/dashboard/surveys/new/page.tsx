import Link from "next/link";

import { SurveyBuilder } from "@/components/surveys/survey-builder";
import {
  buildTemplateDraft,
  isSurveyTemplateId,
  SURVEY_TEMPLATE_SUMMARIES,
} from "@/features/surveys/templates";
import { requireOrganizationManagementContext } from "@/lib/auth/context";

function blankDraft(locationIds: string[]) {
  return {
    surveyId: null,
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    thankYouEn: "Thank you for your feedback.",
    thankYouAr: "شكراً لملاحظاتك.",
    defaultLocale: "en" as const,
    locationIds,
    questions: [],
  };
}

export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const context = await requireOrganizationManagementContext();
  const { template } = await searchParams;
  const locationIds = context.locations[0] ? [context.locations[0].id] : [];

  // Template gallery: shown until a valid template (or "scratch") is chosen.
  if (!template) {
    return (
      <div className="grid gap-7">
        <header>
          <p className="text-sm font-bold text-brand">New survey · استبيان جديد</p>
          <h1 className="mt-2 text-3xl font-bold">Start from a template</h1>
          <p className="mt-2 text-muted">
            Pick a bilingual starter and edit everything afterwards, or start from scratch.
            اختر قالباً ثنائي اللغة ثم عدّله بالكامل، أو ابدأ من الصفر.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {SURVEY_TEMPLATE_SUMMARIES.map((templateSummary) => (
            <Link
              key={templateSummary.id}
              href={`/dashboard/surveys/new?template=${templateSummary.id}`}
              className="grid gap-2 rounded-3xl border border-border bg-white p-6 transition hover:border-brand"
            >
              <h2 className="text-lg font-bold">{templateSummary.nameEn}</h2>
              <p dir="rtl" className="text-sm font-semibold text-muted">{templateSummary.nameAr}</p>
              <p className="text-sm text-muted">{templateSummary.descriptionEn}</p>
              <p className="text-xs font-semibold text-brand">{templateSummary.questionCount} starter questions</p>
            </Link>
          ))}
        </div>
        <Link
          href="/dashboard/surveys/new?template=scratch"
          className="justify-self-start rounded-xl border border-border bg-white px-5 py-3 font-semibold hover:border-brand"
        >
          Start from scratch · ابدأ من الصفر
        </Link>
      </div>
    );
  }

  const initial =
    template !== "scratch" && isSurveyTemplateId(template)
      ? buildTemplateDraft(template, locationIds)
      : blankDraft(locationIds);

  return (
    <div className="grid gap-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand">New draft</p>
          <h1 className="mt-2 text-3xl font-bold">Build a survey</h1>
        </div>
        <Link href="/dashboard/surveys/new" className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold">
          ← Choose a different template
        </Link>
      </header>
      <SurveyBuilder initial={initial} locations={context.locations} />
    </div>
  );
}
