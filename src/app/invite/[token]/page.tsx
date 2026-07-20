import { acceptInvitation } from "@/features/team/actions";
import { getPublicInvitation } from "@/features/team/server";
import { getMessages } from "@/lib/i18n/messages";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ token }, notice] = await Promise.all([params, searchParams]);
  const invitation = await getPublicInvitation(token);
  const locale = invitation.locale ?? "en";
  const messages = getMessages(locale);
  if (invitation.state !== "valid") {
    const stateKey = invitation.state === "expired" ? "invite.expired" : invitation.state === "revoked" ? "invite.revoked" : invitation.state === "used" ? "invite.used" : "invite.unavailable";
    return <main lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="grid min-h-screen place-items-center bg-background p-5"><section className="max-w-md rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">{messages["invite.title"]}</h1><p className="mt-4">{messages[stateKey]}</p></section></main>;
  }
  const next = encodeURIComponent(`/invite/${token}`);
  return <main lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="grid min-h-screen place-items-center bg-background p-5"><section style={{ borderColor: invitation.organization?.primary_color }} className="w-full max-w-lg rounded-3xl border bg-white p-8">{invitation.organization?.logo_url ? <img src={invitation.organization.logo_url} alt={locale === "ar" ? invitation.organization.name_ar : invitation.organization.name_en} className="mb-5 max-h-20 max-w-48 object-contain" /> : null}<p className="text-sm font-bold text-brand">{messages["invite.title"]}</p><h1 className="mt-2 text-3xl font-bold">{locale === "ar" ? invitation.organization?.name_ar : invitation.organization?.name_en}</h1><p className="mt-4">{invitation.email_hint} · {invitation.role?.replaceAll("_", " ")}</p>{invitation.personal_message ? <blockquote className="mt-4 rounded-xl bg-background p-4">{invitation.personal_message}</blockquote> : null}{notice.error ? <p role="alert" className="mt-4 text-red-700">{messages["invite.unavailable"]}</p> : null}<form action={acceptInvitation} className="mt-6"><input type="hidden" name="token" value={token} /><button style={{ backgroundColor: invitation.organization?.primary_color }} className="rounded-xl px-5 py-3 font-bold text-white">{messages["invite.accept"]}</button></form><div className="mt-5 flex gap-4 text-sm"><Link className="font-semibold text-brand" href={`/login?next=${next}&lang=${locale}`}>{messages["invite.signIn"]}</Link><Link className="font-semibold text-brand" href={`/signup?next=${next}&lang=${locale}`}>{messages["auth.createAccount"]}</Link></div></section></main>;
}
