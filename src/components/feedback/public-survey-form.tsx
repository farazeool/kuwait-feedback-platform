"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { randomUUID } from "node:crypto";

import type { PublicSurvey, SubmissionPayload } from "@/features/public-feedback/schema";

type AnswerState = Record<string, number | string | string[] | undefined>;

export interface PublicSurveyFormProps {
  survey: PublicSurvey;
  startedAt: number;
  idempotencyKey: string;
  touchpointToken?: string;
  channel?: "qr" | "kiosk" | "web";
  autoReset?: boolean;
  kioskMode?: boolean;
  staffTestMode?: boolean;
  onKioskComplete?: (success: boolean) => void;
}

/** Question progress indicator — emoji faces for kiosk */
function QuestionProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const pct = Math.round(((current) / total) * 100);
  return (
    <div className="flex items-center gap-3" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
      <span className="text-xs font-semibold text-muted tabular-nums">
        {current} / {total}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PublicSurveyForm({
  survey,
  startedAt,
  idempotencyKey: initialIdempotencyKey,
  touchpointToken,
  channel: propChannel,
  autoReset,
  kioskMode = false,
  staffTestMode,
  onKioskComplete,
}: PublicSurveyFormProps) {
  const channel = propChannel ?? (touchpointToken ? "qr" : "web");
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [validationError, setValidationError] = useState("");
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState(initialIdempotencyKey);
  const [currentStartedAt, setCurrentStartedAt] = useState(startedAt);
  // Track answered questions count for progress
  const answeredCount = survey.questions.filter((q) => {
    const val = answers[q.id];
    return val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0);
  }).length;

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;
  const pick = (value: { en: string | null; ar: string | null }) => (isArabic ? value.ar || value.en || "" : value.en || "");

  const resetForm = useCallback(() => {
    setAnswers({});
    setValidationError("");
    setState("idle");
    setCurrentIdempotencyKey(randomUUID());
    setCurrentStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (autoReset && (state === "success" || state === "duplicate")) {
      resetTimerRef.current = setTimeout(resetForm, 4000);
      return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
    }
  }, [autoReset, state, resetForm]);

  useEffect(() => {
    if (kioskMode && (state === "success" || state === "duplicate")) {
      onKioskComplete?.(state === "success");
    }
  }, [kioskMode, state, onKioskComplete]);

  function getScalePointColor(scaleKey: string, value: number): string | null {
    const scale = survey.rating_scales[scaleKey];
    if (!scale) return null;
    if (value <= scale.negative_max) return "border-red-200 bg-red-50 text-red-700";
    if (value >= scale.satisfied_min) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  function getSelectedScaleColor(scaleKey: string, value: number): string {
    const scale = survey.rating_scales[scaleKey];
    if (!scale) return "border-brand bg-brand/10 text-brand ring-4 ring-brand/10";
    if (value <= scale.negative_max) return "border-red-400 bg-red-100 text-red-800 ring-4 ring-red-100";
    if (value >= scale.satisfied_min) return "border-emerald-400 bg-emerald-100 text-emerald-800 ring-4 ring-emerald-100";
    return "border-amber-400 bg-amber-100 text-amber-800 ring-4 ring-amber-100";
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const form = new FormData(event.currentTarget);
    const payloadAnswers: SubmissionPayload["answers"] = [];

    survey.questions.forEach((question) => {
      const value = answers[question.id];
      if (value === undefined || value === "") return;
      if (question.type === "rating") payloadAnswers.push({ questionId: question.id, rating: Number(value) });
      else if (question.type === "text") payloadAnswers.push({ questionId: question.id, text: String(value) });
      else if (Array.isArray(value)) payloadAnswers.push({ questionId: question.id, optionIds: value });
      else payloadAnswers.push({ questionId: question.id, optionIds: [String(value)] });
    });

    if (survey.questions.some((question) => question.required && !payloadAnswers.some((answer) => answer.questionId === question.id))) {
      setValidationError(isArabic ? "يرجى الإجابة عن جميع الأسئلة المطلوبة." : "Please answer every required question.");
      return;
    }

    setState("submitting");
    try {
      const body: Record<string, unknown> = {
        locale,
        answers: payloadAnswers,
        idempotencyKey: currentIdempotencyKey,
        startedAt: currentStartedAt,
        website: String(form.get("website") ?? ""),
      };
      if (touchpointToken) body.touchpointToken = touchpointToken;
      if (channel !== "web" && !touchpointToken) body.channel = channel;
      if (staffTestMode) body.sourceIdentifier = "staff-test";
      // Use AbortController for a 30-second timeout on the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(`/api/public/surveys/${encodeURIComponent(survey.public_slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const result = await response.json() as { duplicate?: boolean };
      if (!response.ok) throw new Error("submission_failed");
      setState(result.duplicate ? "duplicate" : "success");
    } catch {
      setState("error");
    }
  }

  // If in kiosk mode, success is handled by parent shell — return null
  if ((state === "success" || state === "duplicate") && kioskMode) {
    return null;
  }

  // Standalone thank-you (non-kiosk / web mode)
  if (state === "success" || state === "duplicate") {
    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        lang={locale}
        className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-[#f8faf8] to-[#f0f5ef] px-6"
      >
        <div className="mx-auto w-full max-w-md animate-kiosk-fade-in">
          {branding.logo_url && (
            <img
              alt={pick(survey.organization.name)}
              src={branding.logo_url}
              className="mx-auto mb-8 max-h-16 max-w-40 rounded-xl bg-white p-3 shadow-sm object-contain"
            />
          )}
          <div
            className="mx-auto grid size-20 place-items-center rounded-full text-3xl"
            style={{ color: branding.primary_color, backgroundColor: `${branding.accent_color}20` }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-10">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
              <path d="M8 12.5l3 3 7-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground text-center">
            {pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}
          </h1>
          {state === "duplicate" && (
            <p className="mt-2 text-center text-sm text-muted">
              {isArabic ? "تم استلام هذه الإجابة مسبقاً." : "This response was already received."}
            </p>
          )}
          {pick(branding.footer) && (
            <p className="mt-8 border-t border-border pt-5 text-center text-sm text-muted">{pick(branding.footer)}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      lang={locale}
      className="kiosk-mode flex min-h-screen flex-col px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="mx-auto w-full max-w-2xl">
        {/* Question progress */}
        <div className="mb-6">
          <QuestionProgress current={answeredCount} total={survey.questions.length} />
        </div>

        <form onSubmit={submit} className="grid gap-6">
          {/* Hidden honeypot */}
          <input
            className="absolute -start-[9999px]"
            tabIndex={-1}
            autoComplete="off"
            name="website"
            aria-hidden="true"
          />

          {/* Header card */}
          <header
            className="rounded-3xl p-6 sm:p-8 text-white shadow-lg"
            style={{ backgroundColor: branding.primary_color }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                {branding.logo_url && (
                  <img
                    alt={pick(survey.organization.name)}
                    src={branding.logo_url}
                    className="mb-4 max-h-14 max-w-36 rounded-xl bg-white/95 p-2 object-contain"
                  />
                )}
                <p className="text-sm text-white/75">
                  {pick(survey.organization.name)}
                  <span className="mx-2 opacity-50">·</span>
                  {pick(survey.location.name)}
                </p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{pick(survey.title)}</h1>
                {pick(survey.description) && (
                  <p className="mt-3 text-base leading-relaxed text-white/85">{pick(survey.description)}</p>
                )}
              </div>
              {/* Language toggle */}
              <div className="flex shrink-0 gap-1 self-start rounded-full bg-white/10 p-1" role="group" aria-label={isArabic ? "اختيار اللغة" : "Select language"}>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  aria-label="English"
                  aria-pressed={locale === "en"}
                  title="English"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    locale === "en" ? "bg-white/25 text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("ar")}
                  aria-label="العربية"
                  aria-pressed={locale === "ar"}
                  title="العربية"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    locale === "ar" ? "bg-white/25 text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  ع
                </button>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/60">
              {isArabic ? "* سؤال مطلوب" : "* Required question"}
            </p>
          </header>

          {/* Questions */}
          {survey.questions.map((question, index) => (
            <fieldset
              key={question.id}
              className={`animate-kiosk-fade-in rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6 ${
                answers[question.id] !== undefined ? "ring-2 ring-brand/10" : ""
              }`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <legend className="flex items-start gap-2 px-1">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {index + 1}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {pick(question.prompt)}
                  {question.required && <span className="ms-1 text-red-500">*</span>}
                </span>
              </legend>

              {pick(question.help_text) && (
                <p className="mb-4 mt-2 text-sm text-muted/80 px-1">{pick(question.help_text)}</p>
              )}

              <div className="mt-4">
                {question.type === "rating" && renderRating(question)}
                {question.type === "multiple_choice" && renderMultipleChoice(question)}
                {question.type === "text" && (
                  <textarea
                    name={question.id}
                    maxLength={question.text_max_length ?? 1000}
                    value={String(answers[question.id] ?? "")}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    className="kiosk-input min-h-[120px] resize-y"
                    placeholder={isArabic ? "اكتب تعليقك هنا..." : "Type your feedback here..."}
                    rows={4}
                  />
                )}
              </div>
            </fieldset>
          ))}

          {/* Error messages */}
          {validationError && (
            <p
              role="alert"
              className="animate-kiosk-fade-in rounded-2xl bg-danger-light p-4 text-sm font-medium text-danger"
            >
              {validationError}
            </p>
          )}

          {state === "error" && (
            <div
              role="alert"
              className="animate-kiosk-fade-in rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center"
            >
              <p className="text-sm font-medium text-red-800">
                {isArabic
                  ? "تعذر إرسال الملاحظات. يرجى المحاولة لاحقاً."
                  : "Feedback could not be submitted. Please try again shortly."}
              </p>
              <p className="mt-2 text-xs text-red-600">
                {isArabic
                  ? "تحقق من اتصال الإنترنت وحاول مرة أخرى."
                  : "Check your internet connection and try again."}
              </p>
              <button
                type="button"
                onClick={() => setState("idle")}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4">
                  <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isArabic ? "إعادة المحاولة" : "Try Again"}
              </button>
            </div>
          )}

          {/* Submit button — large touch target for kiosk */}
          {state !== "error" && (
            <button
              disabled={state === "submitting"}
              className="min-h-[60px] w-full rounded-2xl px-8 text-base font-bold text-white shadow-lg transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: branding.primary_color }}
            >
              {state === "submitting" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {isArabic ? "جارٍ الإرسال…" : "Submitting…"}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isArabic ? "إرسال الملاحظات" : "Submit Feedback"}
                </span>
              )}
            </button>
          )}
        </form>

        {/* Footer */}
        {pick(branding.footer) && (
          <footer className="mt-8 pb-6 text-center">
            <p className="text-xs text-muted/60">{pick(branding.footer)}</p>
          </footer>
        )}
      </div>
    </main>
  );

  function renderRating(question: PublicSurvey["questions"][number]) {
    const scaleKey = question.rating_scale;
    const scale = scaleKey ? survey.rating_scales[scaleKey] : null;
    const points = scale?.points.slice().sort((a, b) => a.position - b.position);
    const min = question.rating_min ?? 1;
    const max = question.rating_max ?? 5;

    if (points && points.length > 0) {
      return (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(points.length, 5)}, minmax(0, 1fr))` }}
        >
          {points.map((point) => {
            const isSelected = answers[question.id] === point.value;
            const baseColor = getScalePointColor(scaleKey!, point.value);
            const selectedColor = getSelectedScaleColor(scaleKey!, point.value);
            return (
              <label
                key={point.value}
                className={`kiosk-rating-btn cursor-pointer text-center ${
                  isSelected ? selectedColor : baseColor || "border-border hover:border-brand/30 hover:bg-brand-light/20"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name={question.id}
                  value={point.value}
                  checked={isSelected}
                  onChange={() => setAnswers({ ...answers, [question.id]: point.value })}
                />
                <span className="text-2xl font-bold">{point.value}</span>
                <span className="text-sm font-medium leading-tight">{pick(point.label)}</span>
              </label>
            );
          })}
        </div>
      );
    }

    // Simple numeric grid (1-5 or custom range)
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: max - min + 1 }, (_, offset) => min + offset).map((rating) => {
          const isSelected = answers[question.id] === rating;
          return (
            <label
              key={rating}
              className={`flex size-14 cursor-pointer items-center justify-center rounded-2xl border-2 text-lg font-bold transition-all duration-150 active:scale-90 ${
                isSelected
                  ? "border-brand bg-brand/10 text-brand ring-4 ring-brand/10"
                  : "border-border hover:border-brand/30 hover:bg-brand-light/20"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={question.id}
                value={rating}
                checked={isSelected}
                onChange={() => setAnswers({ ...answers, [question.id]: rating })}
              />
              {rating}
            </label>
          );
        })}
      </div>
    );
  }

  function renderMultipleChoice(question: PublicSurvey["questions"][number]) {
    const isMulti = question.allow_multiple;
    const selected = answers[question.id];
    const selectedSet = new Set(
      Array.isArray(selected) ? selected : selected ? [String(selected)] : [],
    );

    function toggle(optionId: string) {
      if (isMulti) {
        const next = new Set(selectedSet);
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
        setAnswers({ ...answers, [question.id]: Array.from(next) });
      } else {
        setAnswers({ ...answers, [question.id]: optionId });
      }
    }

    return (
      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = selectedSet.has(option.id);
          return (
            <label
              key={option.id}
              className={`flex min-h-[56px] cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 text-base font-medium transition-all duration-150 ${
                isSelected
                  ? "border-brand bg-brand/5 text-foreground ring-4 ring-brand/10"
                  : "border-border hover:border-brand/30 hover:bg-brand-light/10"
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all ${
                  isSelected
                    ? "border-brand bg-brand text-white"
                    : "border-border"
                }`}
              >
                {isSelected && <svg viewBox="0 0 24 24" fill="none" className="size-4"><path d="M6 12l4 4 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </span>
              <span>{pick(option.label)}</span>
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={question.id}
                value={option.id}
                checked={isSelected}
                onChange={() => toggle(option.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
    );
  }
}
