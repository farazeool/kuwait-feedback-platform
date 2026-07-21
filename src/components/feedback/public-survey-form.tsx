"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { randomUUID } from "node:crypto";

import type { PublicSurvey, SubmissionPayload } from "@/features/public-feedback/schema";

type AnswerState = Record<string, number | string | string[] | undefined>;

interface PublicSurveyFormProps {
  survey: PublicSurvey;
  startedAt: number;
  idempotencyKey: string;
  touchpointToken?: string;
  channel?: "qr" | "kiosk" | "web";
  autoReset?: boolean;
}

export function PublicSurveyForm({ survey, startedAt, idempotencyKey: initialIdempotencyKey, touchpointToken, channel: propChannel, autoReset }: PublicSurveyFormProps) {
  const channel = propChannel ?? (touchpointToken ? "qr" : "web");
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [validationError, setValidationError] = useState("");
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState(initialIdempotencyKey);
  const [currentStartedAt, setCurrentStartedAt] = useState(startedAt);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;
  const pick = (value: { en: string | null; ar: string | null }) => isArabic ? value.ar || value.en || "" : value.en || "";

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

  if (state === "success" || state === "duplicate") {
    return <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="grid min-h-screen place-items-center bg-background px-5"><section style={{ borderTopColor: branding.primary_color }} className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center sm:p-8">{branding.logo_url ? <img alt={pick(survey.organization.name)} src={branding.logo_url} className="mx-auto mb-4 max-h-16 max-w-40 object-contain" /> : null}<div style={{ color: branding.primary_color, backgroundColor: `${branding.accent_color}20` }} className="mx-auto grid size-12 place-items-center rounded-full text-xl">✓</div><h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">{pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}</h1>{state === "duplicate" ? <p className="mt-2 text-sm text-muted">{isArabic ? "تم استلام هذه الإجابة مسبقاً." : "This response was already received."}</p> : null}{pick(branding.footer) ? <p className="mt-5 border-t border-border pt-3 text-sm text-muted">{pick(branding.footer)}</p> : null}</section></main>;
  }

  function getScalePointColor(scaleKey: string, value: number): string | null {
    const scale = survey.rating_scales[scaleKey];
    if (!scale) return null;
    if (value <= scale.negative_max) return "bg-red-50 border-red-300 text-red-700";
    if (value >= scale.satisfied_min) return "bg-emerald-50 border-emerald-300 text-emerald-700";
    return "bg-amber-50 border-amber-300 text-amber-700";
  }

  function getSelectedColorClass(scaleKey: string, value: number): string {
    const scale = survey.rating_scales[scaleKey];
    if (!scale) return "border-brand bg-emerald-50 text-brand";
    if (value <= scale.negative_max) return "border-red-400 bg-red-100 text-red-800";
    if (value >= scale.satisfied_min) return "border-emerald-400 bg-emerald-100 text-emerald-800";
    return "border-amber-400 bg-amber-100 text-amber-800";
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
      const body: Record<string, unknown> = { locale, answers: payloadAnswers, idempotencyKey: currentIdempotencyKey, startedAt: currentStartedAt, website: String(form.get("website") ?? "") };
      if (touchpointToken) body.touchpointToken = touchpointToken;
      if (channel !== "web" && !touchpointToken) body.channel = channel;
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

  return <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="min-h-screen bg-background px-4 py-6 sm:py-10"><form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-5"><header style={{ backgroundColor: branding.primary_color }} className="rounded-xl p-5 text-white sm:p-6">{branding.logo_url ? <img alt={pick(survey.organization.name)} src={branding.logo_url} className="mb-4 max-h-16 max-w-40 rounded-md bg-white/95 p-2 object-contain" /> : null}<div className="flex justify-between gap-3"><div><p className="text-xs text-white/70">{pick(survey.organization.name)} · {pick(survey.location.name)}</p><h1 className="mt-2 text-xl font-bold sm:text-2xl">{pick(survey.title)}</h1></div><div className="flex self-start rounded-md bg-white/10 p-0.5"><button type="button" onClick={() => setLocale("en")} className={`rounded px-2 py-1 text-xs font-semibold ${locale === "en" ? "bg-white/20" : ""}`}>EN</button><button type="button" onClick={() => setLocale("ar")} className={`rounded px-2 py-1 text-xs font-semibold ${locale === "ar" ? "bg-white/20" : ""}`}>ع</button></div></div>{pick(survey.description) ? <p className="mt-3 text-sm leading-relaxed text-white/85">{pick(survey.description)}</p> : null}<p className="mt-3 text-xs text-white/70">{isArabic ? "* سؤال مطلوب" : "* Required question"}</p></header>
    <input className="absolute -start-[9999px]" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
    {survey.questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border border-border bg-white p-5"><legend className="px-1 text-sm font-semibold text-foreground">{index + 1}. {pick(question.prompt)} {question.required ? <span className="text-red-600">*</span> : null}</legend>{pick(question.help_text) ? <p className="mb-3 text-xs text-muted">{pick(question.help_text)}</p> : null}
      {question.type === "rating" ? renderRating(question) : null}
      {question.type === "multiple_choice" ? renderMultipleChoice(question) : null}
      {question.type === "text" ? <textarea name={question.id} maxLength={question.text_max_length ?? 1000} value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} className="min-h-28 w-full rounded-lg border border-border p-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15" /> : null}
    </fieldset>)}
    {validationError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{validationError}</p> : null}{state === "error" ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{isArabic ? "تعذر إرسال الملاحظات. يرجى المحاولة لاحقاً." : "Feedback could not be submitted. Please try again shortly."}</p> : null}<button disabled={state === "submitting"} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60">{state === "submitting" ? (isArabic ? "جارٍ الإرسال…" : "Submitting…") : (isArabic ? "إرسال الملاحظات" : "Submit feedback")}</button>
    {pick(branding.footer) ? <footer className="pb-4 text-center text-xs text-muted">{pick(branding.footer)}</footer> : null}</form></main>;

  function renderRating(question: PublicSurvey["questions"][number]) {
    const scaleKey = question.rating_scale;
    const scale = scaleKey ? survey.rating_scales[scaleKey] : null;
    const points = scale?.points.slice().sort((a, b) => a.position - b.position);
    const min = question.rating_min ?? 1;
    const max = question.rating_max ?? 5;

    if (points && points.length > 0) {
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((point) => {
            const isSelected = answers[question.id] === point.value;
            const colorClass = isSelected ? getSelectedColorClass(scaleKey!, point.value) : getScalePointColor(scaleKey!, point.value);
            return (
              <label key={point.value} className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${colorClass ?? "border-border hover:border-brand/40"}`}>
                <input className="sr-only" type="radio" name={question.id} value={point.value} checked={isSelected} onChange={() => setAnswers({ ...answers, [question.id]: point.value })} />
                <span className="text-lg font-bold">{point.value}</span>
                <span className="text-[10px] leading-tight">{pick(point.label)}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return <div className="flex flex-wrap gap-1.5">{Array.from({ length: max - min + 1 }, (_, offset) => min + offset).map((rating) => <label key={rating} className={`grid size-10 cursor-pointer place-items-center rounded-lg border text-sm font-semibold transition-colors ${answers[question.id] === rating ? "border-brand bg-emerald-50 text-brand" : "border-border hover:border-brand/40"}`}><input className="sr-only" type="radio" name={question.id} value={rating} checked={answers[question.id] === rating} onChange={() => setAnswers({ ...answers, [question.id]: rating })} />{rating}</label>)}</div>;
  }

  function renderMultipleChoice(question: PublicSurvey["questions"][number]) {
    const isMulti = question.allow_multiple;
    const selected = answers[question.id];
    const selectedSet = new Set(Array.isArray(selected) ? selected : selected ? [String(selected)] : []);

    function toggle(optionId: string) {
      if (isMulti) {
        const next = new Set(selectedSet);
        if (next.has(optionId)) next.delete(optionId); else next.add(optionId);
        setAnswers({ ...answers, [question.id]: Array.from(next) });
      } else {
        setAnswers({ ...answers, [question.id]: optionId });
      }
    }

    const inputType = isMulti ? "checkbox" : "radio";

    return <div className="grid gap-1.5">{question.options.map((option) => <label key={option.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-brand/40"><input type={inputType} name={question.id} value={option.id} checked={selectedSet.has(option.id)} onChange={() => toggle(option.id)} /><span>{pick(option.label)}</span></label>)}</div>;
  }
}
