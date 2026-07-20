import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/forms/field";
import { signIn } from "@/features/auth/actions";

const ERRORS: Record<string, string> = {
  invalid_input: "Enter a valid email address and password.",
  invalid_credentials: "The email address or password is incorrect.",
  invalid_callback: "That authentication link is incomplete.",
  verification_failed: "That verification link is invalid or has expired.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage your organizations, locations, and customer feedback."
    >
      {params.reset ? (
        <p className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Your password was updated. You can sign in now.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {ERRORS[params.error] ?? "Sign in could not be completed. Please try again."}
        </p>
      ) : null}
      <form action={signIn} className="grid gap-5">
        <Field label="Email address" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end">
          <Link className="text-sm font-semibold text-brand hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <button className="min-h-11 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark" type="submit">
          Sign in
        </button>
      </form>
      <p className="mt-7 border-t border-border pt-6 text-center text-sm text-muted" dir="rtl" lang="ar">
        سجّل الدخول لإدارة ملاحظات عملائك
      </p>
    </AuthCard>
  );
}
