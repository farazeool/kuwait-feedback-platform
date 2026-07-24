import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import { QuickFeedbackForm } from "@/components/feedback/quick-feedback-form";
import { createPublicFeedbackSession, getPublicSurvey } from "@/features/public-feedback/server";

export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ t?: string; ch?: string; c?: string; e?: string; r?: string }> }) {
  const { publicId } = await params;
  const sp = await searchParams;
  const touchpointToken = sp.t;
  const channel = sp.ch;
  const campaignId = sp.c;
  const employeeName = sp.e;
  const referenceNumber = sp.r;

  const survey = await getPublicSurvey(publicId);
  if (!survey) return <main className="grid min-h-screen place-items-center bg-background px-5"><section className="max-w-md rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Survey unavailable</h1><p className="mt-3 leading-6 text-muted">This survey may be closed, archived, or the link may be invalid.</p><p className="mt-5 border-t border-border pt-5" dir="rtl" lang="ar">الاستبيان غير متاح حالياً</p></section></main>;

  // Check if quick feedback is enabled for this survey
  const surveyWithQf = survey as unknown as Record<string, unknown>;
  const qfConfig = surveyWithQf.quick_feedback_config as {
    is_enabled: boolean;
    rating_style: string;
    positive_threshold: number;
    negative_threshold: number;
    follow_up_enabled: boolean;
    show_comment_field: boolean;
  } | null;

  const session = createPublicFeedbackSession();

  if (qfConfig?.is_enabled) {
    return <QuickFeedbackForm survey={survey} config={qfConfig} {...session} touchpointToken={touchpointToken} channel={channel} campaignId={campaignId} employeeName={employeeName} referenceNumber={referenceNumber} />;
  }

  return <PublicSurveyForm survey={survey} {...session} touchpointToken={touchpointToken} />;
}
