"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import type { PublicSurvey } from "@/features/public-feedback/schema";
import { useKioskConfig } from "@/hooks/use-kiosk-config";
import { KioskPausedScreen, KioskMaintenanceScreen } from "@/components/kiosk/kiosk-status-screens";

interface KioskShellProps {
  survey: PublicSurvey;
  session: { idempotencyKey: string; startedAt: number };
  touchpointToken?: string;
}

const IDLE_TIMEOUT_MS = 45_000;
const THANK_YOU_SECONDS = 5;

export function KioskShell({ survey, session, touchpointToken }: KioskShellProps) {
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [phase, setPhase] = useState<"welcome" | "survey" | "thankyou">("welcome");
  const [countdown, setCountdown] = useState(THANK_YOU_SECONDS);
  const idleTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [surveyKey, setSurveyKey] = useState(0);
  const [staffTestMode, setStaffTestMode] = useState(false);
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;

  // Kiosk device management - poll for config updates if touchpointToken provided
  const { config: kioskConfig } = useKioskConfig({
    accessToken: touchpointToken || null,
    onConfigChange: (newSlug) => {
      // Survey changed remotely - reload the page to get new survey
      if (newSlug) {
        window.location.href = `/kiosk/${newSlug}?t=${touchpointToken}`;
      }
    },
    onStatusChange: (newStatus) => {
      // Status changed - the UI will automatically show paused/maintenance screen
      console.log("Kiosk status changed:", newStatus);
    },
  });

  // Check if kiosk is paused or in maintenance
  const kioskStatus = kioskConfig?.status || "active";

  const pick = (value: { en: string | null; ar: string | null }) =>
    isArabic ? value.ar || value.en || "" : value.en || "";

  const resetToWelcome = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setPhase("welcome");
    setCountdown(THANK_YOU_SECONDS);
    setSurveyKey((k) => k + 1);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(resetToWelcome, IDLE_TIMEOUT_MS);
  }, [resetToWelcome]);

  const startSurvey = useCallback(() => {
    setPhase("survey");
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Fullscreen on mount with tap-to-fallback
  useEffect(() => {
    const tryFullscreen = async () => {
      try { await document.documentElement.requestFullscreen(); } catch { /* user gesture needed */ }
    };
    tryFullscreen();
    const handleFS = () => { /* no-op — track if needed */ };
    document.addEventListener("fullscreenchange", handleFS);
    return () => document.removeEventListener("fullscreenchange", handleFS);
  }, []);

  // Idle timer events
  useEffect(() => {
    const events = ["mousedown", "touchstart", "keydown", "click"] as const;
    events.forEach((e) => document.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Trap back navigation
  useEffect(() => {
    history.pushState(null, "", location.href);
    const handlePop = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleSubmitDone = useCallback((success: boolean) => {
    if (!success) return;
    setPhase("thankyou");
    setCountdown(THANK_YOU_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          resetToWelcome();
          return THANK_YOU_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetToWelcome]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ========== STATUS SCREENS ==========
  // Show paused screen if kiosk is paused
  if (touchpointToken && kioskStatus === "paused") {
    return (
      <KioskPausedScreen
        locale={locale}
        branding={branding}
        organizationName={survey.organization.name}
      />
    );
  }

  // Show maintenance screen if kiosk is in maintenance
  if (touchpointToken && kioskStatus === "maintenance") {
    return (
      <KioskMaintenanceScreen
        locale={locale}
        branding={branding}
        organizationName={survey.organization.name}
      />
    );
  }

  // ========== WELCOME SCREEN ==========
  if (phase === "welcome") {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        lang={locale}
        className="kiosk-mode fixed inset-0 flex flex-col bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef]"
        role="application"
        aria-label={isArabic ? "شاشة الترحيب" : "Welcome Screen"}
      >
        {/* Brand bar */}
        <header className="flex items-center justify-between px-8 pt-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={pick(survey.organization.name)}
                  className="max-h-10 max-w-32 object-contain cursor-pointer"
                  onClick={() => setStaffTestMode((prev) => !prev)}
                />
              ) : (
                <span
                  className="text-lg font-bold cursor-pointer"
                  style={{ color: branding.primary_color }}
                  onClick={() => setStaffTestMode((prev) => !prev)}
                >
                  {pick(survey.organization.name)}
                </span>
              )}
              {staffTestMode && (
                <span className="absolute -top-1 -end-1 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-sm">
                  TEST
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                locale === "en" ? "bg-brand text-white shadow-md" : "text-muted hover:text-foreground"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale("ar")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                locale === "ar" ? "bg-brand text-white shadow-md" : "text-muted hover:text-foreground"
              }`}
            >
              العربية
            </button>
          </div>
        </header>

        {/* Hero */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mx-auto max-w-2xl animate-kiosk-fade-in">
            {/* Icon */}
            <div
              className="mx-auto grid size-20 place-items-center rounded-full animate-kiosk-float"
              style={{ backgroundColor: `${branding.primary_color}15`, color: branding.primary_color }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-10">
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>

            <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              {pick(survey.title)}
            </h1>

            {pick(survey.description) && (
              <p className="mt-4 text-lg leading-relaxed text-muted sm:text-xl">
                {pick(survey.description)}
              </p>
            )}

            {/* Location tag */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-sm text-muted shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              {pick(survey.location.name)}
            </div>
          </div>

          {/* CTA — large touch target */}
          <div className="mt-12 animate-kiosk-slide-up">
            <button
              type="button"
              onClick={startSurvey}
              className="min-h-[64px] min-w-[280px] rounded-full px-12 text-lg font-bold text-white shadow-xl transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: branding.primary_color }}
            >
              {isArabic ? "ابدأ التقييم" : "Start Feedback"}
            </button>
            <p className="mt-3 text-sm text-muted" dir={isArabic ? "rtl" : "ltr"}>
              {isArabic ? "سيستغرق ذلك دقيقة واحدة فقط" : "Takes just one minute"}
            </p>
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

  // ========== THANK YOU SCREEN ==========
  if (phase === "thankyou") {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        lang={locale}
        className="kiosk-mode fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef]"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-lg px-8 text-center animate-kiosk-scale-in">
          {/* Success checkmark */}
          <div
            className="mx-auto grid size-28 place-items-center rounded-full animate-kiosk-bounce-in"
            style={{ backgroundColor: `${branding.primary_color}12`, color: branding.primary_color }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-14" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
              <path
                d="M8 12.5l3 3 7-7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank You for Your Feedback")}
          </h1>

          <p className="mt-4 text-lg text-muted">
            {isArabic
              ? "نحن نقدر وقتك وملاحظاتك تساعدنا على التحسن"
              : "We appreciate your time. Your feedback helps us improve."}
          </p>

          {/* Countdown circle */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <svg viewBox="0 0 36 36" className="size-16 -rotate-90" aria-hidden="true">
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke="#d8e0dc"
                strokeWidth="3"
              />
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke={branding.primary_color}
                strokeWidth="3"
                strokeDasharray={`${(countdown / THANK_YOU_SECONDS) * 100} 100`}
                strokeLinecap="round"
                className="transition-all duration-500 ease-linear"
              />
            </svg>
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: branding.primary_color }}
              aria-live="polite"
              aria-atomic="true"
            >
              {countdown}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted">
            {isArabic ? "إعادة التشغيل تلقائياً..." : "Resetting automatically..."}
          </p>
        </div>

        {/* Footer */}
        {pick(branding.footer) && (
          <footer className="absolute bottom-6 px-8 text-center">
            <p className="text-xs text-muted/60">{pick(branding.footer)}</p>
          </footer>
        )}
      </main>
    );
  }

  // ========== SURVEY PHASE ==========
  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      lang={locale}
      className="kiosk-mode fixed inset-0 overflow-y-auto bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef]"
      role="application"
      aria-label={isArabic ? "الاستبيان" : "Survey"}
    >
      {/* Progress bar at top */}
      <div className="sticky top-0 z-10 h-2 w-full bg-border/30" aria-hidden="true">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: "0%", backgroundColor: branding.primary_color }}
        />
      </div>

      <PublicSurveyForm
        key={surveyKey}
        survey={survey}
        startedAt={session.startedAt}
        idempotencyKey={session.idempotencyKey}
        touchpointToken={touchpointToken}
        channel="kiosk"
        autoReset={false}
        kioskMode={true}
        staffTestMode={staffTestMode}
        onKioskComplete={handleSubmitDone}
      />
    </main>
  );
}
