import { Field, SelectField } from "@/components/forms/field";
import { createOrganization } from "@/features/onboarding/actions";
import {
  BUSINESS_CATEGORIES,
  GOVERNORATES,
} from "@/features/onboarding/schema";
import { requireOnboardingUser } from "@/lib/auth/context";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Review the highlighted information and use the required format.",
  duplicate_slug: "That organization slug is already in use. Choose another.",
  onboarding_failed: "We could not create the organization. No partial setup was saved.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireOnboardingUser();
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-xl">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">Secure onboarding</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Set up your organization</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your owner access, organization, and first Kuwait location are created together. Nothing is partially saved.
        </p>
      </header>
      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.onboarding_failed}
        </p>
      ) : null}
      <form action={createOrganization} className="mt-6 grid gap-5">
        <fieldset className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2 sm:p-6">
          <legend className="px-1 text-base font-semibold text-foreground">Organization</legend>
          <Field label="English name" name="organizationNameEn" required maxLength={160} />
          <Field label="Arabic name (optional)" name="organizationNameAr" dir="rtl" lang="ar" maxLength={160} />
          <Field label="Organization slug" name="organizationSlug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" hint="Lowercase letters, numbers, and hyphens" />
          <SelectField label="Business category" name="businessCategory" required defaultValue="other">
            {BUSINESS_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category.replaceAll("_", " ")}</option>
            ))}
          </SelectField>
          <Field label="Kuwait phone (optional)" name="phone" type="tel" placeholder="+96522223333" pattern="\+965[0-9]{8}" />
        </fieldset>
        <fieldset className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2 sm:p-6">
          <legend className="px-1 text-base font-semibold text-foreground">First location</legend>
          <Field label="English name" name="locationNameEn" required maxLength={160} />
          <Field label="Arabic name (optional)" name="locationNameAr" dir="rtl" lang="ar" maxLength={160} />
          <SelectField label="Governorate" name="governorate" required defaultValue="capital">
            {GOVERNORATES.map((governorate) => (
              <option key={governorate} value={governorate}>{governorate.replaceAll("_", " ")}</option>
            ))}
          </SelectField>
          <Field label="Area" name="area" required maxLength={120} placeholder="e.g. Sharq" />
          <div className="sm:col-span-2">
            <Field label="Address (optional)" name="address" maxLength={500} />
          </div>
          <div className="rounded-lg bg-background p-3 text-xs text-muted sm:col-span-2">
            Timezone: <strong className="font-semibold text-foreground">Asia/Kuwait</strong>
          </div>
        </fieldset>
        <button className="min-h-10 justify-self-start rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:justify-self-end" type="submit">
          Create organization
        </button>
      </form>
    </main>
  );
}
