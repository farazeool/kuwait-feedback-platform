import { SurveyBuilder } from "@/components/surveys/survey-builder";
import { requireOrganizationManagementContext } from "@/lib/auth/context";

export default async function NewSurveyPage() {
  const context = await requireOrganizationManagementContext();
  return <div className="grid gap-7"><header><p className="text-sm font-bold text-brand">New draft</p><h1 className="mt-2 text-3xl font-bold">Build a survey</h1></header><SurveyBuilder initial={{ surveyId: null, titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "", thankYouEn: "Thank you for your feedback.", thankYouAr: "شكراً لملاحظاتك.", defaultLocale: "en", locationIds: context.locations[0] ? [context.locations[0].id] : [], questions: [] }} locations={context.locations} /></div>;
}
