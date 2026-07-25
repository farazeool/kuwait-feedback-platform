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
  const isArabic = locale === "ar";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f0f5ef] via-white to-white px-4">
      {/* Brand */}
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-brand">
          <svg viewBox="0 0 24 24" fill="none" className="size-6 text-white">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xl font-bold text-foreground">{messages["app.name"]}</span>
      </Link>

      <AuthCard
        locale={locale}
        title={messages["auth.signIn"]}
        description={messages["auth.description"]}
      >
        {params.reset ? (
          <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {messages["auth.passwordUpdated"]}
          </div>
        ) : null}

        {params.verify ? (
          <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {messages["auth.confirmEmail"]}
          </div>
        ) : null}

        {params.error ? (
          <div role="alert" className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">
            {messages["auth.invalid"]}
          </div>
        ) : null}

        <form action={signIn} className="grid gap-5">
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
            <Link
              className="text-sm font-medium text-brand transition-colors hover:text-brand-dark hover:underline"
              href={isArabic ? "/forgot-password?lang=ar" : "/forgot-password"}
            >
              {messages["auth.forgotPassword"]}?
            </Link>
          </div>

          <button
            className="min-h-[48px] w-full rounded-2xl bg-brand px-4 text-base font-semibold text-white shadow-lg shadow-brand/20 transition-all duration-200 hover:bg-brand-dark active:scale-[0.98]"
            type="submit"
          >
            {messages["auth.signIn"]}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted">
            {isArabic ? "ليس لديك حساب؟" : "Don&apos;t have an account?"}{" "}
            <Link
              className="font-semibold text-brand hover:text-brand-dark hover:underline"
              href={`/signup?next=${encodeURIComponent(params.next ?? "")}&lang=${locale}`}
            >
              {messages["auth.createAccount"]}
            </Link>
          </p>
        </div>

        <div className="mt-5 border-t border-border pt-5 text-center">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            href={`/login?lang=${isArabic ? "en" : "ar"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4">
              <path d="M12 2a10 10 0 1 0 10 10h-3.6a6.5 6.5 0 1 1-6.4-8V2z" stroke="currentColor" strokeWidth="2" />
            </svg>
            {messages["auth.switchLanguage"]}
          </Link>
        </div>
      </AuthCard>

      <p className="mt-8 text-xs text-muted/60">
        &copy; {new Date().getFullYear()} Kuwait Feedback Platform
      </p>
    </div>
  );
}
