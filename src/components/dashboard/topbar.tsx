import { signOut } from "@/features/auth/actions";
import { getMessages, type Locale } from "@/lib/i18n/messages";

/* eslint-disable @next/next/no-img-element */

export function DashboardTopbar({
  displayName,
  organizationName,
  locationName,
  role,
  locale,
  logoUrl,
}: {
  displayName: string;
  organizationName: string;
  locationName: string;
  role: string;
  locale: Locale;
  logoUrl: string | null;
}) {
  const messages = getMessages(locale);
  return (
    <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-5 py-4 print:hidden sm:px-8">
      <div className="flex items-center gap-3">
        {logoUrl ? <img src={logoUrl} alt="" className="size-10 rounded-lg object-contain" /> : null}
        <div>
        <p className="font-bold">{organizationName}</p>
        <p className="text-sm text-muted">{locationName}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden text-end sm:block">
          <p className="text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted">{role.replaceAll("_", " ")}</p>
        </div>
        <form action={signOut}>
          <button className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-background" type="submit">
            {messages["auth.signOut"]}
          </button>
        </form>
      </div>
    </header>
  );
}
