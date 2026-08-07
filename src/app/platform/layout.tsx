import Link from "next/link";

import { requirePlatformAdminContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePlatformAdminContext();
  const messages = getMessages(context.profile.locale);
  return <div lang={context.profile.locale} dir={context.profile.locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-background"><header className="border-b border-border bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3"><Link href="/platform" className="text-sm font-bold">{messages["platform.title"]}</Link><nav className="flex gap-4 text-sm font-medium"><Link className="text-slate-300 transition-colors hover:text-white" href="/platform/organizations">{messages["platform.organizations"]}</Link><Link className="text-slate-300 transition-colors hover:text-white" href="/platform/audit">{messages["platform.audit"]}</Link><Link className="text-slate-300 transition-colors hover:text-white" href="/dashboard">{messages["nav.overview"]}</Link></nav></div></header><main className="mx-auto max-w-7xl px-5 py-6">{children}</main></div>;
}
