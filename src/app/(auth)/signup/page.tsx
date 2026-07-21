import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/forms/field";
import { signUp } from "@/features/auth/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; lang?: string }> }) {
  const params = await searchParams;
  const locale = params.lang === "ar" ? "ar" : "en";
  const messages = getMessages(locale);
  return <AuthCard locale={locale} title={messages["auth.createAccount"]} description={messages["auth.description"]}>{params.error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{messages["common.error"]}</p> : null}<form action={signUp} className="grid gap-4"><input type="hidden" name="next" value={params.next ?? ""} /><Field label={messages["auth.email"]} name="email" type="email" autoComplete="email" required /><Field label={messages["auth.password"]} name="password" type="password" autoComplete="new-password" minLength={12} required /><button className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">{messages["auth.createAccount"]}</button></form><p className="mt-4 text-center text-sm"><Link className="font-medium text-brand hover:underline" href={`/login?next=${encodeURIComponent(params.next ?? "")}&lang=${locale}`}>{messages["auth.signIn"]}</Link></p></AuthCard>;
}
