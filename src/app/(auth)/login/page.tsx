import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/forms/field";
import { signIn } from "@/features/auth/actions";
import { getMessages } from "@/lib/i18n/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; verify?: string; next?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const locale = params.lang === "ar" ? "ar" : "en";
  const messages = getMessages(locale);
  return (
    <AuthCard
      locale={locale}
      title={messages["auth.signIn"]}
      description={messages["auth.description"]}
    >
      {params.reset ? (
        <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {messages["auth.passwordUpdated"]}
        </p>
      ) : null}
      {params.verify ? <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{messages["auth.confirmEmail"]}</p> : null}
      {params.error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {messages["auth.invalid"]}
        </p>
      ) : null}
      <form action={signIn} className="grid gap-4">
        <input type="hidden" name="next" value={params.next ?? ""} />
        <Field label={messages["auth.email"]} name="email" type="email" autoComplete="email" required />
        <Field
          label={messages["auth.password"]}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end">
          <Link className="text-sm font-medium text-brand hover:underline" href="/forgot-password">
            {messages["auth.forgotPassword"]}?
          </Link>
        </div>
        <button className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark" type="submit">
          {messages["auth.signIn"]}
        </button>
      </form>
      <p className="mt-4 text-center text-sm"><Link className="font-medium text-brand hover:underline" href={`/signup?next=${encodeURIComponent(params.next ?? "")}&lang=${locale}`}>{messages["auth.createAccount"]}</Link></p>
      <p className="mt-5 border-t border-border pt-4 text-center text-sm"><Link className="font-medium text-brand hover:underline" href={`/login?lang=${locale === "ar" ? "en" : "ar"}`}>{messages["auth.switchLanguage"]}</Link></p>
    </AuthCard>
  );
}
