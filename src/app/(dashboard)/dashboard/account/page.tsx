import Link from "next/link";

import { requireAppAccessContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/messages";

export default async function AccountPage() {
  const context = await requireAppAccessContext();
  const messages = getMessages(context.profile.locale);
  return <div className="grid gap-7"><h1 className="text-3xl font-bold">{messages["account.title"]}</h1><div className="grid gap-4 md:grid-cols-2"><Link className="rounded-3xl border border-border bg-white p-6 text-xl font-bold text-brand" href="/dashboard/account/profile">{messages["account.profile"]}</Link><Link className="rounded-3xl border border-border bg-white p-6 text-xl font-bold text-brand" href="/dashboard/account/security">{messages["account.security"]}</Link></div></div>;
}
