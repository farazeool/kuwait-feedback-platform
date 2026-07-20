import Link from "next/link";

import { requirePlatformAdminContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePlatformAdminContext();
  const messages = getMessages(context.profile.locale);
  return <div lang={context.profile.locale} dir={context.profile.locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-background"><header className="border-b border-border bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4"><Link href="/platform" className="font-bold">{messages["platform.title"]}</Link><nav className="flex gap-4 text-sm"><Link href="/platform/organizations">{messages["platform.organizations"]}</Link><Link href="/platform/audit">{messages["platform.audit"]}</Link><Link href="/dashboard">{messages["nav.overview"]}</Link></nav></div></header><main className="mx-auto max-w-7xl px-5 py-8">{children}</main></div>;
}
