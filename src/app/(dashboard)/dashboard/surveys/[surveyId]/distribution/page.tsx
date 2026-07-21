import { PrintButton } from "@/components/surveys/print-button";
import { QrCard } from "@/components/surveys/qr-card";
import { buildFeedbackUrl } from "@/features/distribution/qr";
import { getSurveyDistribution } from "@/features/surveys/server";
import { getServerEnv } from "@/lib/env/server";

/* eslint-disable @next/next/no-img-element */

export default async function DistributionPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  const [distribution, env] = await Promise.all([getSurveyDistribution(surveyId), Promise.resolve(getServerEnv())]);
  return (
    <div className="grid gap-7 print:bg-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {distribution.organization?.logo_url ? (
            <img src={distribution.organization.logo_url} alt="" className="max-h-16 max-w-40 object-contain" />
          ) : null}
          <div>
            <p style={{ color: distribution.organization?.primary_color }} className="text-sm font-bold">
              QR distribution · توزيع رمز QR
            </p>
            <h1 className="mt-2 text-3xl font-bold">{distribution.titleEn}</h1>
            {distribution.titleAr ? (
              <p dir="rtl" className="text-muted">
                {distribution.titleAr}
              </p>
            ) : null}
            <p className="text-muted">{distribution.organization?.name_en}</p>
            {distribution.organization?.name_ar ? (
              <p dir="rtl" className="text-sm text-muted">
                {distribution.organization.name_ar}
              </p>
            ) : null}
          </div>
        </div>
        <PrintButton labelEn="Print cards" labelAr="طباعة البطاقات" />
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        {distribution.members.map((member) => (
          <QrCard
            key={member.id}
            locationNameEn={member.location?.name_en ?? ""}
            locationNameAr={member.location?.name_ar ?? ""}
            feedbackUrl={buildFeedbackUrl(env.NEXT_PUBLIC_APP_URL, member.public_slug)}
            primaryColor={distribution.organization?.primary_color ?? null}
            status={member.status}
          />
        ))}
      </div>
      {distribution.organization?.footer_text_en || distribution.organization?.footer_text_ar ? (
        <footer className="text-center text-sm text-muted">
          {distribution.organization?.footer_text_en ? <p>{distribution.organization.footer_text_en}</p> : null}
          {distribution.organization?.footer_text_ar ? (
            <p dir="rtl">{distribution.organization.footer_text_ar}</p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
