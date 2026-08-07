"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PublicSurvey } from "@/features/public-feedback/schema";

export interface QuickFeedbackFormProps {
  survey: PublicSurvey;
  config: {
    is_enabled: boolean;
    rating_style: string;
    positive_threshold: number;
    negative_threshold: number;
    follow_up_enabled: boolean;
    show_comment_field: boolean;
  };
  startedAt: number;
  idempotencyKey: string;
  touchpointToken?: string;
  channel?: string;
  campaignId?: string;
  employeeName?: string;
  referenceNumber?: string;
  distributionToken?: string;
  kioskMode?: boolean;
  onKioskComplete?: (success: boolean) => void;
}

const EMOJI_LEVELS = [
  { value: 5, emoji: "😊", labelEn: "Excellent", labelAr: "ممتاز" },
  { value: 4, emoji: "🙂", labelEn: "Good", labelAr: "جيد" },
  { value: 3, emoji: "😐", labelEn: "Average", labelAr: "متوسط" },
  { value: 2, emoji: "☹", labelEn: "Poor", labelAr: "سيئ" },
  { value: 1, emoji: "😡", labelEn: "Very Poor", labelAr: "سيئ جداً" },
];

export function QuickFeedbackForm({
  survey,
  config,
  startedAt: initialStartedAt,
  idempotencyKey: initialIdempotencyKey,
  touchpointToken,
  channel,
  campaignId,
  employeeName,
  referenceNumber,
  distributionToken,
  kioskMode = false,
  onKioskComplete,
}: QuickFeedbackFormProps) {
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState(initialIdempotencyKey);
  const [currentStartedAt, setCurrentStartedAt] = useState(initialStartedAt);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;
  const pick = (value: { en: string | null; ar: string | null }) => (isArabic ? value.ar || value.en || "" : value.en || "");

  const categories = (survey as unknown as Record<string, unknown>).quick_feedback_categories as Array<{ id: string; label_en: string; label_ar: string }> | undefined;

  const resetForm = useCallback(() => {
    setSelectedRating(null);
    setSelectedConcern(null);
    setComment("");
    setShowFollowUp(false);
    setState("idle");
    setCurrentIdempotencyKey(crypto.randomUUID());
    setCurrentStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (kioskMode && (state === "success" || state === "duplicate")) {
      resetTimerRef.current = setTimeout(resetForm, 5000);
      return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
    }
  }, [kioskMode, state, resetForm]);

  useEffect(() => {
    if (kioskMode && (state === "success" || state === "duplicate")) {
      onKioskComplete?.(state === "success");
    }
  }, [kioskMode, state, onKioskComplete]);

  if (state === "success" || state === "duplicate") {
    if (kioskMode) return null;
    return (
      <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="grid min-h-screen place-items-center bg-background px-5">
        <section style={{ borderTopColor: branding.primary_color }} className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center sm:p-8">
          {branding.logo_url ? <img alt={pick(survey.organization.name)} src={branding.logo_url} className="mx-auto mb-4 max-h-16 max-w-40 object-contain" /> : null}
          <div style={{ color: branding.primary_color, backgroundColor: `${branding.accent_color}20` }} className="mx-auto grid size-12 place-items-center rounded-full text-xl">✓</div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">{pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}</h1>
          {state === "duplicate" ? <p className="mt-2 text-sm text-muted">{isArabic ? "تم استلام هذه الإجابة مسبقاً." : "This response was already received."}</p> : null}
          {pick(branding.footer) ? <p className="mt-5 border-t border-border pt-3 text-sm text-muted">{pick(branding.footer)}</p> : null}
        </section>
      </main>
    );
  }

  async function submitFeedback(rating: number, concern?: string, commentText?: string) {
    setState("submitting");
    const completionMs = Date.now() - currentStartedAt; // eslint-disable-line

    try {
      const body: Record<string, unknown> = {
        locale,
        idempotencyKey: currentIdempotencyKey,
        startedAt: currentStartedAt,
        website: "",
        channel: channel ?? "web",
        feedbackMode: "quick",
        quickRating: rating,
        completionMs,
      };
      if (touchpointToken) body.touchpointToken = touchpointToken;
      if (distributionToken) body.distributionToken = distributionToken;
      if (campaignId) body.campaignId = campaignId;
      if (employeeName) body.employeeReference = employeeName;
      if (referenceNumber) body.interactionReference = referenceNumber;
      if (concern) body.quickCategories = [concern];
      if (commentText?.trim()) body.quickComment = commentText.trim();

      const response = await fetch(`/api/public/surveys/${encodeURIComponent(survey.public_slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { duplicate?: boolean };
      if (!response.ok) throw new Error("submission_failed");
      setState(result.duplicate ? "duplicate" : "success");
    } catch {
      setState("error");
    }
  }

  function handleRatingClick(rating: number) {
    setSelectedRating(rating);
    const isPositive = rating >= config.positive_threshold;

    if (isPositive || !config.follow_up_enabled) {
      submitFeedback(rating);
    } else {
      setShowFollowUp(true);
    }
  }

  function handleFollowUpSubmit() {
    if (selectedRating !== null && selectedConcern) {
      submitFeedback(selectedRating, selectedConcern, comment);
    }
  }

  return (
    <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-xl gap-5">
        <header style={{ backgroundColor: branding.primary_color }} className="rounded-xl p-5 text-white sm:p-6">
          {branding.logo_url ? <img alt={pick(survey.organization.name)} src={branding.logo_url} className="mb-4 max-h-16 max-w-40 rounded-md bg-white/95 p-2 object-contain" /> : null}
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-xs text-white/70">{pick(survey.organization.name)} · {pick(survey.location.name)}</p>
              <h1 className="mt-2 text-xl font-bold sm:text-2xl">{isArabic ? "كيف كانت تجربتك؟" : "How was your experience?"}</h1>
            </div>
            <div className="flex self-start rounded-md bg-white/10 p-0.5">
              <button type="button" onClick={() => setLocale("en")} className={`rounded px-2 py-1 text-xs font-semibold ${locale === "en" ? "bg-white/20" : ""}`}>EN</button>
              <button type="button" onClick={() => setLocale("ar")} className={`rounded px-2 py-1 text-xs font-semibold ${locale === "ar" ? "bg-white/20" : ""}`}>ع</button>
            </div>
          </div>
          {pick(survey.description) ? <p className="mt-3 text-sm leading-relaxed text-white/85">{pick(survey.description)}</p> : null}
        </header>

        {!showFollowUp ? (
          <div className="rounded-xl border border-border bg-white p-5 text-center">
            <p className="mb-5 text-lg font-semibold text-foreground">{isArabic ? "اضغط للتقييم" : "Tap to rate"}</p>
            <div className="flex justify-center gap-2 sm:gap-4">
              {EMOJI_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  disabled={state === "submitting"}
                  onClick={() => handleRatingClick(level.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-3 transition-all hover:scale-110 hover:bg-accent/10 ${state === "submitting" ? "opacity-50" : ""}`}
                >
                  {config.rating_style === "emoji" ? (
                    <span className="text-4xl sm:text-5xl">{level.emoji}</span>
                  ) : (
                    <span className="text-4xl sm:text-5xl">{level.value}</span>
                  )}
                  <span className="text-xs font-medium text-muted">{isArabic ? level.labelAr : level.labelEn}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="mb-4 text-lg font-semibold text-foreground">{isArabic ? "ما الذي يمكننا تحسينه؟" : "What could we improve?"}</p>
            <div className="grid gap-2">
              {(categories ?? []).map((cat) => (
                <label key={cat.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${selectedConcern === cat.id ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"}`}>
                  <input type="radio" name="concern" value={cat.id} checked={selectedConcern === cat.id} onChange={() => setSelectedConcern(cat.id)} className="sr-only" />
                  <span className="text-foreground">{isArabic ? cat.label_ar || cat.label_en : cat.label_en}</span>
                </label>
              ))}
            </div>

            {config.show_comment_field && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-foreground">
                  {isArabic ? "هل لديك أي تعليقات إضافية؟ (اختياري)" : "Any additional comments? (optional)"}
                </label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} className="min-h-20 w-full rounded-lg border border-border p-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15" />
              </div>
            )}

            <button type="button" disabled={!selectedConcern || state === "submitting"} onClick={handleFollowUpSubmit} className="mt-4 min-h-11 w-full rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60">
              {state === "submitting" ? (isArabic ? "جارٍ الإرسال…" : "Submitting…") : (isArabic ? "إرسال الملاحظات" : "Submit feedback")}
            </button>
          </div>
        )}

        {state === "error" ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {isArabic ? "تعذر إرسال الملاحظات. يرجى المحاولة لاحقاً." : "Feedback could not be submitted. Please try again shortly."}
          </p>
        ) : null}

        {pick(branding.footer) ? <footer className="pb-4 text-center text-xs text-muted">{pick(branding.footer)}</footer> : null}
      </div>
    </main>
  );
}
