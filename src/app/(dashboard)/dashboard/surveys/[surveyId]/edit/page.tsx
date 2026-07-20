import { redirect } from "next/navigation";

import { SurveyBuilder } from "@/components/surveys/survey-builder";
import { getSurveyEditor } from "@/features/surveys/server";
import { requireOrganizationManagementContext } from "@/lib/auth/context";

export default async function EditSurveyPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const [{ surveyId }, context] = await Promise.all([params, requireOrganizationManagementContext()]);
  const survey = await getSurveyEditor(surveyId);
  if (survey.status !== "draft") redirect(`/dashboard/surveys/${surveyId}`);
  return <div className="grid gap-7"><header><p className="text-sm font-bold text-brand">Draft editor</p><h1 className="mt-2 text-3xl font-bold">Edit survey</h1></header><SurveyBuilder initial={survey.draft} locations={context.locations} /></div>;
}
