import Link from "next/link";

import { requireAppAccessContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function AccountPage() {
  const context = await requireAppAccessContext();
  const messages = getMessages(context.profile.locale);
  return <div className="grid gap-6"><h1 className="text-2xl font-bold tracking-tight text-foreground">{messages["account.title"]}</h1><div className="grid gap-4 md:grid-cols-2"><Link className="rounded-xl border border-border bg-white p-6 text-base font-semibold text-brand" href="/dashboard/account/profile">{messages["account.profile"]}</Link><Link className="rounded-xl border border-border bg-white p-6 text-base font-semibold text-brand" href="/dashboard/account/security">{messages["account.security"]}</Link></div></div>;
}
