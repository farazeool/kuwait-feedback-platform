import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import { createPublicFeedbackSession, getPublicSurvey } from "@/features/public-feedback/server";

export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { publicId } = await params;
  const { t: touchpointToken } = await searchParams;
  const survey = await getPublicSurvey(publicId);
  if (!survey) return <main className="grid min-h-screen place-items-center bg-background px-5"><section className="max-w-md rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Survey unavailable</h1><p className="mt-3 leading-6 text-muted">This survey may be closed, archived, or the link may be invalid.</p><p className="mt-5 border-t border-border pt-5" dir="rtl" lang="ar">الاستبيان غير متاح حالياً</p></section></main>;
  const session = createPublicFeedbackSession();
  return <PublicSurveyForm survey={survey} {...session} touchpointToken={touchpointToken} />;
}
