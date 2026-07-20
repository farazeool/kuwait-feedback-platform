import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/forms/field";
import { requestPasswordReset } from "@/features/auth/actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email. If it matches an account, we’ll send a secure reset link."
      footer={{ label: "Remembered it?", href: "/login", linkLabel: "Back to sign in" }}
    >
      {sent ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
          If that address belongs to an account, a reset link is on its way.
        </p>
      ) : (
        <form action={requestPasswordReset} className="grid gap-5">
          <Field label="Email address" name="email" type="email" autoComplete="email" required />
          <button className="min-h-11 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark" type="submit">
            Send reset link
          </button>
        </form>
      )}
    </AuthCard>
  );
}
