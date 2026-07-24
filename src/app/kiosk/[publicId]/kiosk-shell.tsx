"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicSurveyForm } from "@/components/feedback/public-survey-form";
import type { PublicSurvey } from "@/features/public-feedback/schema";

interface KioskShellProps {
  survey: PublicSurvey;
  session: { idempotencyKey: string; startedAt: number };
  touchpointToken?: string;
}

const IDLE_TIMEOUT_MS = 30_000;
const THANK_YOU_COUNTDOWN_SECONDS = 5;
const CHECKMARK_SVG = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-16" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path d="M8 12.5l3 3 7-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function KioskShell({ survey, session, touchpointToken }: KioskShellProps) {
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [countdown, setCountdown] = useState(THANK_YOU_COUNTDOWN_SECONDS);
  const idleTimerRef = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;
  const pick = (value: { en: string | null; ar: string | null }) =>
    isArabic ? value.ar || value.en || "" : value.en || "";

  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch { /* continue */ }
    };
    requestFullscreen();
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setShowForm(true);
      setCountdown(THANK_YOU_COUNTDOWN_SECONDS);
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "touchstart", "keydown", "click"] as const;
    events.forEach((event) => document.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((event) => document.removeEventListener(event, resetIdleTimer));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const handleSubmitComplete = useCallback((success: boolean) => {
    if (success) {
      setShowForm(false);
      setCountdown(THANK_YOU_COUNTDOWN_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setShowForm(true);
            setCountdown(THANK_YOU_COUNTDOWN_SECONDS);
            return THANK_YOU_COUNTDOWN_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    history.pushState(null, "", location.href);
    const handlePopState = () => { history.pushState(null, "", location.href); };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (showForm) {
    return (
      <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="fixed inset-0 bg-white" role="application" aria-label={isArabic ? "استطلاع كشك" : "Kiosk Survey"}>
        {!isFullscreen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-white" aria-hidden="true">
            <div className="mx-auto max-w-2xl px-6 text-center">
              <p className="text-lg font-medium text-foreground">{isArabic ? "اضغط للشاشة الكاملة" : "Tap for fullscreen"}</p>
              <p className="mt-2 text-sm text-muted">{isArabic ? "يبدأ الاستطلاع تلقائياً" : "Survey starts automatically"}</p>
            </div>
          </div>
        )}
        <PublicSurveyForm survey={survey} startedAt={session.startedAt} idempotencyKey={session.idempotencyKey}
          touchpointToken={touchpointToken} channel="kiosk" autoReset={false} onKioskComplete={handleSubmitComplete} />
      </main>
    );
  }

  return (
    <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="fixed inset-0 bg-white grid place-items-center"
      role="status" aria-live="polite" aria-label={isArabic ? "شكراً لك" : "Thank you"}>
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div style={{ color: branding.primary_color, backgroundColor: `${branding.accent_color}20` }}
          className="mx-auto grid size-24 place-items-center rounded-full text-2xl" aria-hidden="true">
          {CHECKMARK_SVG}
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          {pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}
        </h1>
        <div className="mt-4 text-5xl font-mono font-bold tabular-nums" style={{ color: branding.primary_color }}
          aria-live="polite" aria-atomic="true">
          {countdown}
        </div>
        <p className="mt-4 text-sm text-muted" aria-hidden="true">
          {isArabic ? `إعادة التحميل خلال ${countdown} ثوانٍ` : `Resetting in ${countdown} second${countdown !== 1 ? "s" : ""}`}
        </p>
        {pick(branding.footer) && (
          <p className="mt-8 border-t border-border pt-4 text-sm text-muted">{pick(branding.footer)}</p>
        )}
      </div>
    </main>
  );
}
