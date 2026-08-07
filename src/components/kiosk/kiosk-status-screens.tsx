"use client";

interface KioskStatusScreenProps {
  locale: "en" | "ar";
  branding: {
    logo_url?: string | null;
    primary_color: string;
    footer: { en: string | null; ar: string | null };
  };
  organizationName: { en: string | null; ar: string | null };
}

export function KioskPausedScreen({ locale, branding, organizationName }: KioskStatusScreenProps) {
  const isArabic = locale === "ar";
  const pick = (value: { en: string | null; ar: string | null }) =>
    isArabic ? value.ar || value.en || "" : value.en || "";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      lang={locale}
      className="kiosk-mode fixed inset-0 flex flex-col bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef]"
      role="status"
      aria-live="polite"
    >
      {/* Brand bar */}
      <header className="flex items-center justify-between px-8 pt-8">
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={pick(organizationName)}
              className="max-h-10 max-w-32 object-contain"
            />
          ) : (
            <span className="text-lg font-bold" style={{ color: branding.primary_color }}>
              {pick(organizationName)}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mx-auto max-w-2xl animate-kiosk-fade-in">
          {/* Pause icon */}
          <div
            className="mx-auto grid size-20 place-items-center rounded-full"
            style={{ backgroundColor: `${branding.primary_color}15`, color: branding.primary_color }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-10">
              <rect x="6" y="4" width="4" height="16" fill="currentColor" rx="1" />
              <rect x="14" y="4" width="4" height="16" fill="currentColor" rx="1" />
            </svg>
          </div>

          {/* English message */}
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground">
            This kiosk is temporarily paused.
          </h1>

          {/* Arabic message */}
          <h2
            className="mt-6 text-3xl font-bold tracking-tight text-foreground"
            dir="rtl"
            lang="ar"
          >
            هذا الجهاز متوقف مؤقتاً.
          </h2>

          <p className="mt-6 text-lg text-muted">
            {isArabic
              ? "سيتم تحديث الإعدادات تلقائياً..."
              : "Configuration will update automatically..."}
          </p>

          {/* Pulsing indicator */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color }}
            />
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color, animationDelay: "0.2s" }}
            />
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color, animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      {pick(branding.footer) && (
        <footer className="px-8 pb-6 text-center">
          <p className="text-xs text-muted/60">{pick(branding.footer)}</p>
        </footer>
      )}
    </main>
  );
}

export function KioskRevokedScreen() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-black px-5">
      <section className="max-w-md rounded-3xl border border-white/20 bg-white/5 p-8 text-center text-white">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-red-500/20">
          <svg viewBox="0 0 24 24" fill="none" className="size-8 text-red-400">
            <path
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Device Revoked</h1>
        <p className="mt-3 text-white/70">
          This kiosk device has been revoked and is no longer authorized to collect feedback.
        </p>
        <p className="mt-2 text-sm text-white/50">
          Please contact your administrator for assistance.
        </p>
      </section>
    </main>
  );
}

interface KioskNoSurveyScreenProps {
  organizationName: { en: string | null; ar: string | null };
}

export function KioskNoSurveyScreen({ organizationName }: KioskNoSurveyScreenProps) {
  const name = organizationName.en || organizationName.ar || "Organization";

  return (
    <main className="fixed inset-0 grid place-items-center bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef] px-5">
      <section className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-amber-100">
          <svg viewBox="0 0 24 24" fill="none" className="size-8 text-amber-600">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">No Survey Assigned</h1>
        <p className="mt-3 text-gray-600">
          This kiosk has not been assigned a survey yet.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Please contact your administrator at <span className="font-medium">{name}</span> to assign a survey.
        </p>
      </section>
    </main>
  );
}

export function KioskMaintenanceScreen({ locale, branding, organizationName }: KioskStatusScreenProps) {
  const isArabic = locale === "ar";
  const pick = (value: { en: string | null; ar: string | null }) =>
    isArabic ? value.ar || value.en || "" : value.en || "";

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      lang={locale}
      className="kiosk-mode fixed inset-0 flex flex-col bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef]"
      role="status"
      aria-live="polite"
    >
      {/* Brand bar */}
      <header className="flex items-center justify-between px-8 pt-8">
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={pick(organizationName)}
              className="max-h-10 max-w-32 object-contain"
            />
          ) : (
            <span className="text-lg font-bold" style={{ color: branding.primary_color }}>
              {pick(organizationName)}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mx-auto max-w-2xl animate-kiosk-fade-in">
          {/* Maintenance icon */}
          <div
            className="mx-auto grid size-20 place-items-center rounded-full"
            style={{ backgroundColor: `${branding.primary_color}15`, color: branding.primary_color }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-10">
              <path
                d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* English message */}
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground">
            This kiosk is temporarily unavailable for maintenance.
          </h1>

          {/* Arabic message */}
          <h2
            className="mt-6 text-3xl font-bold tracking-tight text-foreground"
            dir="rtl"
            lang="ar"
          >
            هذا الجهاز غير متاح مؤقتاً للصيانة.
          </h2>

          <p className="mt-6 text-lg text-muted">
            {isArabic
              ? "يرجى الاتصال بالموظفين للحصول على المساعدة."
              : "Please contact staff for assistance."}
          </p>

          {/* Pulsing indicator */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color }}
            />
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color, animationDelay: "0.2s" }}
            />
            <div
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: branding.primary_color, animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      {pick(branding.footer) && (
        <footer className="px-8 pb-6 text-center">
          <p className="text-xs text-muted/60">{pick(branding.footer)}</p>
        </footer>
      )}
    </main>
  );
}
