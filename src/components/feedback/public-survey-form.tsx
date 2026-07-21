"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

import type { PublicSurvey, SubmissionPayload } from "@/features/public-feedback/schema";

type AnswerState = Record<string, number | string | undefined>;

export function PublicSurveyForm({ survey, startedAt, idempotencyKey }: { survey: PublicSurvey; startedAt: number; idempotencyKey: string }) {
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [validationError, setValidationError] = useState("");
  const isArabic = locale === "ar";
  const branding = survey.organization.branding;
  const pick = (value: { en: string | null; ar: string | null }) => isArabic ? value.ar || value.en || "" : value.en || "";

  if (state === "success" || state === "duplicate") {
    return <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="grid min-h-screen place-items-center bg-background px-5"><section style={{ borderTopColor: branding.primary_color }} className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center sm:p-8">{branding.logo_url ? <img alt={pick(survey.organization.name)} src={branding.logo_url} className="mx-auto mb-4 max-h-16 max-w-40 object-contain" /> : null}<div style={{ color: branding.primary_color, backgroundColor: `${branding.accent_color}20` }} className="mx-auto grid size-12 place-items-center rounded-full text-xl">✓</div><h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">{pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}</h1>{state === "duplicate" ? <p className="mt-2 text-sm text-muted">{isArabic ? "تم استلام هذه الإجابة مسبقاً." : "This response was already received."}</p> : null}{pick(branding.footer) ? <p className="mt-5 border-t border-border pt-3 text-sm text-muted">{pick(branding.footer)}</p> : null}</section></main>;
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
      else payloadAnswers.push({ questionId: question.id, optionIds: [String(value)] });
    });
    if (survey.questions.some((question) => question.required && !payloadAnswers.some((answer) => answer.questionId === question.id))) {
      setValidationError(isArabic ? "يرجى الإجابة عن جميع الأسئلة المطلوبة." : "Please answer every required question.");
      return;
    }
    setState("submitting");
    try {
      const response = await fetch(`/api/public/surveys/${encodeURIComponent(survey.public_slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, answers: payloadAnswers, idempotencyKey, startedAt, website: String(form.get("website") ?? "") }),
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
      {question.type === "rating" ? <div className="flex flex-wrap gap-1.5">{Array.from({ length: (question.rating_max ?? 5) - (question.rating_min ?? 1) + 1 }, (_, offset) => (question.rating_min ?? 1) + offset).map((rating) => <label key={rating} className={`grid size-10 cursor-pointer place-items-center rounded-lg border text-sm font-semibold transition-colors ${answers[question.id] === rating ? "border-brand bg-emerald-50 text-brand" : "border-border hover:border-brand/40"}`}><input className="sr-only" type="radio" name={question.id} value={rating} checked={answers[question.id] === rating} onChange={() => setAnswers({ ...answers, [question.id]: rating })} />{rating}</label>)}</div> : null}
      {question.type === "multiple_choice" ? <div className="grid gap-1.5">{question.options.map((option) => <label key={option.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-brand/40"><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} /><span>{pick(option.label)}</span></label>)}</div> : null}
      {question.type === "text" ? <textarea name={question.id} maxLength={question.text_max_length ?? 1000} value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} className="min-h-28 w-full rounded-lg border border-border p-2.5 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15" /> : null}
    </fieldset>)}
    {validationError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{validationError}</p> : null}{state === "error" ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{isArabic ? "تعذر إرسال الملاحظات. يرجى المحاولة لاحقاً." : "Feedback could not be submitted. Please try again shortly."}</p> : null}<button disabled={state === "submitting"} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60">{state === "submitting" ? (isArabic ? "جارٍ الإرسال…" : "Submitting…") : (isArabic ? "إرسال الملاحظات" : "Submit feedback")}</button>
    {pick(branding.footer) ? <footer className="pb-4 text-center text-xs text-muted">{pick(branding.footer)}</footer> : null}</form></main>;
}
