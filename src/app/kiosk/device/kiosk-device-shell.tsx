"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import type { KioskDeviceState } from "@/features/kiosk/device-server";
import { KioskPausedScreen, KioskMaintenanceScreen } from "@/components/kiosk/kiosk-status-screens";
import type { PublicSurvey } from "@/features/public-feedback/schema";

interface KioskDeviceShellProps {
  state: KioskDeviceState;
  mode: "active" | "paused" | "maintenance";
}

const IDLE_TIMEOUT_MS = 45_000;
const THANK_YOU_SECONDS = 5;
const HEARTBEAT_INTERVAL_MS = 30_000;

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function KioskDeviceShell({ state, mode }: KioskDeviceShellProps) {
  const { device, survey, organization, location } = state;

  // All hooks must be called before any early returns
  const [locale, setLocale] = useState<"en" | "ar">(() => survey?.default_locale || "en");
  const [phase, setPhase] = useState<"welcome" | "survey" | "thankyou">("welcome");
  const [countdown, setCountdown] = useState(THANK_YOU_SECONDS);
  const [surveyKey, setSurveyKey] = useState(0);
  const [staffTestMode, setStaffTestMode] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(device.status);
  const [sessionId, setSessionId] = useState(() => ({
    idempotencyKey: generateIdempotencyKey(),
    startedAt: Date.now(),
  }));

  const idleTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isArabic = locale === "ar";

  // Branding with proper type handling
  const branding = {
    primary_color: organization.branding.primary_color,
    logo_url: organization.branding.logo_url,
    footer: organization.branding.footer || { en: null, ar: null },
  };

  const pick = useCallback(
    (value: { en: string | null; ar: string | null }) =>
      isArabic ? value.ar || value.en || "" : value.en || "",
    [isArabic]
  );

  const resetToWelcome = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setPhase("welcome");
    setCountdown(THANK_YOU_SECONDS);
    setSurveyKey((k) => k + 1);
    setSessionId({
      idempotencyKey: generateIdempotencyKey(),
      startedAt: Date.now(),
    });
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(resetToWelcome, IDLE_TIMEOUT_MS);
  }, [resetToWelcome]);

  const startSurvey = useCallback(() => {
    setPhase("survey");
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Heartbeat to update last_seen_at and check for status changes
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/kiosk/heartbeat", {
          method: "POST",
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status && data.status !== currentStatus) {
            setCurrentStatus(data.status);
            if (data.status === "revoked") {
              window.location.reload();
            }
          }
        } else if (response.status === 401) {
          window.location.href = "/kiosk/activate";
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    };

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [currentStatus]);

  // Fullscreen on mount
  useEffect(() => {
    const tryFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // User gesture needed
      }
    };
    tryFullscreen();
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
    history.pushState(null, "", window.location.href);
    const handlePop = () => history.pushState(null, "", window.location.href);
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
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // ========== RENDER BASED ON STATUS ==========

  // Show paused screen based on current status
  if (currentStatus === "paused" || mode === "paused") {
    return (
      <KioskPausedScreen
        locale={locale}
        branding={branding}
        organizationName={organization.name}
      />
    );
  }

  // Show maintenance screen
  if (currentStatus === "maintenance" || mode === "maintenance") {
    return (
      <KioskMaintenanceScreen
        locale={locale}
        branding={branding}
        organizationName={organization.name}
      />
    );
  }

  // No survey to display
  if (!survey) {
    return (
      <main className="fixed inset-0 grid place-items-center bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef] px-5">
        <section className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-gray-900">No Survey Assigned</h1>
          <p className="mt-3 text-gray-600">
            This kiosk has not been assigned a survey yet.
          </p>
        </section>
      </main>
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
                  alt={pick(organization.name)}
                  className="max-h-10 max-w-32 object-contain cursor-pointer"
                  onClick={() => setStaffTestMode((prev) => !prev)}
                />
              ) : (
                <span
                  className="text-lg font-bold cursor-pointer"
                  style={{ color: branding.primary_color }}
                  onClick={() => setStaffTestMode((prev) => !prev)}
                >
                  {pick(organization.name)}
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

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-sm text-muted shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
              {pick(location.name)}
            </div>
          </div>

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

        {branding.footer && pick(branding.footer) && (
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
            {survey.thank_you
              ? pick(survey.thank_you)
              : isArabic
                ? "شكراً لملاحظاتك"
                : "Thank You for Your Feedback"}
          </h1>

          <p className="mt-4 text-lg text-muted">
            {isArabic
              ? "نحن نقدر وقتك وملاحظاتك تساعدنا على التحسن"
              : "We appreciate your time. Your feedback helps us improve."}
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <svg viewBox="0 0 36 36" className="size-16 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#d8e0dc" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
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
      <div className="sticky top-0 z-10 h-2 w-full bg-border/30" aria-hidden="true">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: "0%", backgroundColor: branding.primary_color }}
        />
      </div>

      <PublicSurveyForm
        key={surveyKey}
        survey={survey as PublicSurvey}
        startedAt={sessionId.startedAt}
        idempotencyKey={sessionId.idempotencyKey}
        touchpointToken={device.public_id}
        channel="kiosk"
        autoReset={false}
        kioskMode={true}
        staffTestMode={staffTestMode}
        onKioskComplete={handleSubmitDone}
      />
    </main>
  );
}