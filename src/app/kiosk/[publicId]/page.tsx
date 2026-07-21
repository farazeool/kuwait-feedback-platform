import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import { createPublicFeedbackSession, getPublicSurvey } from "@/features/public-feedback/server";

export default async function KioskPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ t?: string }> }) {
  const { publicId } = await params;
  const { t: touchpointToken } = await searchParams;
  const survey = await getPublicSurvey(publicId);
  if (!survey) return <main className="grid min-h-screen place-items-center bg-black px-5"><section className="max-w-md rounded-3xl border border-white/20 bg-white/5 p-8 text-center text-white"><h1 className="text-2xl font-bold">Kiosk unavailable</h1><p className="mt-3 text-white/70">This kiosk survey may be closed or the link may be invalid.</p></section></main>;
  const session = createPublicFeedbackSession();
  return <KioskShell survey={survey} session={session} touchpointToken={touchpointToken} />;
}

function KioskShell({ survey, session, touchpointToken }: { survey: Awaited<ReturnType<typeof getPublicSurvey>>; session: ReturnType<typeof createPublicFeedbackSession>; touchpointToken?: string }) {
  if (!survey) return null;
  return (
    <main className="fixed inset-0 overflow-auto bg-background">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <KioskForm survey={survey} session={session} touchpointToken={touchpointToken} />
      </div>
    </main>
  );
}

function KioskForm({ survey, session, touchpointToken }: { survey: NonNullable<Awaited<ReturnType<typeof getPublicSurvey>>>; session: ReturnType<typeof createPublicFeedbackSession>; touchpointToken?: string }) {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <PublicSurveyForm
        survey={survey}
        startedAt={session.startedAt}
        idempotencyKey={session.idempotencyKey}
        touchpointToken={touchpointToken}
        channel="kiosk"
        autoReset
      />
    </div>
  );
}
