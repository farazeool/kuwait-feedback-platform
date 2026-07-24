import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import { QuickFeedbackForm } from "@/components/feedback/quick-feedback-form";
import { createPublicFeedbackSession, getPublicSurvey } from "@/features/public-feedback/server";

export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ t?: string; d?: string; ch?: string; c?: string; e?: string; r?: string }> }) {
  const { publicId } = await params;
  const sp = await searchParams;
  const touchpointToken = sp.t;
  const distributionToken = sp.d;
  const channel = sp.ch;
  const campaignId = sp.c;
  const employeeName = sp.e;
  const referenceNumber = sp.r;

  const survey = await getPublicSurvey(publicId);
  if (!survey) return <main className="grid min-h-screen place-items-center bg-background px-5"><section className="max-w-md rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Survey unavailable</h1><p className="mt-3 leading-6 text-muted">This survey may be closed, archived, or the link may be invalid.</p><p className="mt-5 border-t border-border pt-5" dir="rtl" lang="ar">الاستبيان غير متاح حالياً</p></section></main>;

  // Check if quick feedback is enabled — fields now properly typed in publicSurveySchema
  const qfConfig = survey.quick_feedback_enabled ? {
    is_enabled: survey.quick_feedback_enabled,
    rating_style: survey.quick_feedback_rating_style,
    positive_threshold: survey.quick_feedback_positive_threshold,
    negative_threshold: survey.quick_feedback_negative_threshold,
    follow_up_enabled: true,
    show_comment_field: true,
  } : null;

  const session = createPublicFeedbackSession();

  if (qfConfig?.is_enabled) {
    return <QuickFeedbackForm survey={survey} config={qfConfig} {...session} touchpointToken={touchpointToken} channel={channel} campaignId={campaignId} employeeName={employeeName} referenceNumber={referenceNumber} distributionToken={distributionToken} />;
  }

  return <PublicSurveyForm survey={survey} {...session} touchpointToken={touchpointToken} />;
}
