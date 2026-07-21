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
    <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-white/95 px-5 py-3 backdrop-blur-sm print:hidden sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {logoUrl ? <img src={logoUrl} alt="" className="size-9 rounded-lg object-contain" /> : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{organizationName}</p>
          <p className="truncate text-xs text-muted">{locationName}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-end sm:block">
          <p className="text-sm font-medium text-foreground">{displayName}</p>
          <p className="text-xs capitalize text-muted">{role.replaceAll("_", " ")}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-foreground" type="submit">
            {messages["auth.signOut"]}
          </button>
        </form>
      </div>
    </header>
  );
}
