"use client";

import { useState } from "react";

import type { PublicSurvey, SubmissionPayload } from "@/features/public-feedback/schema";

type AnswerState = Record<string, number | string | undefined>;

export function PublicSurveyForm({ survey, startedAt, idempotencyKey }: { survey: PublicSurvey; startedAt: number; idempotencyKey: string }) {
  const [locale, setLocale] = useState<"en" | "ar">(survey.default_locale);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "duplicate" | "error">("idle");
  const [validationError, setValidationError] = useState("");
  const isArabic = locale === "ar";
  const pick = (value: { en: string | null; ar: string | null }) => isArabic ? value.ar || value.en || "" : value.en || "";

  if (state === "success" || state === "duplicate") {
    return <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="grid min-h-screen place-items-center bg-background px-5"><section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div><h1 className="mt-5 text-3xl font-bold">{pick(survey.thank_you) || (isArabic ? "شكراً لملاحظاتك" : "Thank you for your feedback")}</h1>{state === "duplicate" ? <p className="mt-3 text-sm text-muted">{isArabic ? "تم استلام هذه الإجابة مسبقاً." : "This response was already received."}</p> : null}</section></main>;
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

  return <main dir={isArabic ? "rtl" : "ltr"} lang={locale} className="min-h-screen bg-background px-4 py-6 sm:py-12"><form onSubmit={submit} className="mx-auto grid w-full max-w-2xl gap-6"><header className="rounded-3xl bg-brand p-6 text-white sm:p-8"><div className="flex justify-between gap-4"><div><p className="text-sm text-emerald-100">{pick(survey.organization.name)} · {pick(survey.location.name)}</p><h1 className="mt-3 text-3xl font-bold">{pick(survey.title)}</h1></div><div className="flex self-start rounded-xl bg-white/10 p-1"><button type="button" onClick={() => setLocale("en")} className="rounded-lg px-2 py-1 text-sm font-bold">EN</button><button type="button" onClick={() => setLocale("ar")} className="rounded-lg px-2 py-1 text-sm font-bold">ع</button></div></div>{pick(survey.description) ? <p className="mt-4 leading-7 text-emerald-50">{pick(survey.description)}</p> : null}<p className="mt-4 text-xs text-emerald-100">{isArabic ? "* سؤال مطلوب" : "* Required question"}</p></header>
    <input className="absolute -start-[9999px]" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
    {survey.questions.map((question, index) => <fieldset key={question.id} className="rounded-3xl border border-border bg-white p-6"><legend className="px-2 text-lg font-bold">{index + 1}. {pick(question.prompt)} {question.required ? <span className="text-red-600">*</span> : null}</legend>{pick(question.help_text) ? <p className="mb-4 text-sm text-muted">{pick(question.help_text)}</p> : null}
      {question.type === "rating" ? <div className="flex flex-wrap gap-2">{Array.from({ length: (question.rating_max ?? 5) - (question.rating_min ?? 1) + 1 }, (_, offset) => (question.rating_min ?? 1) + offset).map((rating) => <label key={rating} className={`grid size-12 cursor-pointer place-items-center rounded-xl border font-bold ${answers[question.id] === rating ? "border-brand bg-emerald-50 text-brand" : "border-border"}`}><input className="sr-only" type="radio" name={question.id} value={rating} checked={answers[question.id] === rating} onChange={() => setAnswers({ ...answers, [question.id]: rating })} />{rating}</label>)}</div> : null}
      {question.type === "multiple_choice" ? <div className="grid gap-2">{question.options.map((option) => <label key={option.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border p-3"><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers({ ...answers, [question.id]: option.id })} /><span>{pick(option.label)}</span></label>)}</div> : null}
      {question.type === "text" ? <textarea name={question.id} maxLength={question.text_max_length ?? 1000} value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} className="min-h-32 w-full rounded-xl border border-border p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /> : null}
    </fieldset>)}
    {validationError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{validationError}</p> : null}{state === "error" ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{isArabic ? "تعذر إرسال الملاحظات. يرجى المحاولة لاحقاً." : "Feedback could not be submitted. Please try again shortly."}</p> : null}<button disabled={state === "submitting"} className="min-h-14 rounded-2xl bg-brand px-6 text-lg font-bold text-white disabled:opacity-60">{state === "submitting" ? (isArabic ? "جارٍ الإرسال…" : "Submitting…") : (isArabic ? "إرسال الملاحظات" : "Submit feedback")}</button>
    </form></main>;
}
