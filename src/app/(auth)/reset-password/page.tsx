import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/forms/field";
import { resetPassword } from "@/features/auth/actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthCard
      title="Choose a new password"
      description="Use at least 10 characters and avoid a password used on another service."
      footer={{ label: "Need a new link?", href: "/forgot-password", linkLabel: "Request one" }}
    >
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error === "session_expired"
            ? "Your reset session expired. Request a new link."
            : "Passwords must match and contain at least 10 characters."}
        </p>
      ) : null}
      <form action={resetPassword} className="grid gap-4">
        <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required />
        <button className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark" type="submit">
          Update password
        </button>
      </form>
    </AuthCard>
  );
}
