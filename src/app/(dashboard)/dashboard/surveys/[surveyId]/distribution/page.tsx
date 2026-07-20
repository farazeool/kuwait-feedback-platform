import Image from "next/image";

import { CopyLinkButton } from "@/components/surveys/copy-link-button";
import { buildFeedbackUrl } from "@/features/distribution/qr";
import { getSurveyDistribution } from "@/features/surveys/server";
import { getServerEnv } from "@/lib/env/server";

/* eslint-disable @next/next/no-img-element */

export default async function DistributionPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;
  const [distribution, env] = await Promise.all([getSurveyDistribution(surveyId), Promise.resolve(getServerEnv())]);
  return <div className="grid gap-7 print:bg-white"><header className="flex items-center gap-4">{distribution.organization?.logo_url ? <img src={distribution.organization.logo_url} alt="" className="max-h-16 max-w-40 object-contain" /> : null}<div><p style={{ color: distribution.organization?.primary_color }} className="text-sm font-bold">QR distribution</p><h1 className="mt-2 text-3xl font-bold">{distribution.titleEn}</h1><p className="text-muted">{distribution.organization?.name_en}</p></div></header><div className="grid gap-6 lg:grid-cols-2">{distribution.members.map((member) => { const url = buildFeedbackUrl(env.NEXT_PUBLIC_APP_URL, member.public_slug); const qr = `/api/qr?value=${encodeURIComponent(url)}`; return <article key={member.id} style={{ borderTopColor: distribution.organization?.primary_color }} className="grid gap-5 rounded-3xl border border-t-4 border-border bg-white p-6 print:break-inside-avoid"><div><p className="font-bold">{member.location?.name_en}</p><p dir="rtl" className="text-sm text-muted">{member.location?.name_ar}</p><p className={`mt-2 text-sm font-semibold ${member.status === "active" ? "text-emerald-700" : "text-amber-700"}`}>{member.status === "active" ? "Active and accepting feedback" : "Not currently active"}</p></div><Image unoptimized width={256} height={256} className="mx-auto aspect-square w-64" src={`${qr}&format=svg`} alt={`QR code for ${member.location?.name_en}`} /><div className="break-all rounded-xl bg-background p-3 text-xs">{url}</div><div className="flex flex-wrap gap-2 print:hidden"><CopyLinkButton value={url} /><a className="rounded-xl border border-border px-3 py-2 text-sm font-semibold" href={`${qr}&format=svg&download=1`}>Download SVG</a><a className="rounded-xl border border-border px-3 py-2 text-sm font-semibold" href={`${qr}&format=png&download=1`}>Download PNG</a></div></article>; })}</div>{distribution.organization?.footer_text_en ? <footer className="text-center text-sm text-muted">{distribution.organization.footer_text_en}</footer> : null}</div>;
}
