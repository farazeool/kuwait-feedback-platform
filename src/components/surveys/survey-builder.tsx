"use client";

import { useEffect, useMemo, useState } from "react";

import { saveSurveyDraft } from "@/features/surveys/actions";
import {
  surveyDraftSchema,
  type SurveyBuilderQuestion,
  type SurveyDraft,
} from "@/features/surveys/schemas";

type LocationOption = { id: string; nameEn: string; nameAr: string };

export function SurveyBuilder({
  initial,
  locations,
}: {
  initial: SurveyDraft;
  locations: LocationOption[];
}) {
  const [draft, setDraft] = useState(initial);
  const [showPreview, setShowPreview] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">(initial.defaultLocale);
  const parsed = useMemo(() => surveyDraftSchema.safeParse(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updateQuestion = (index: number, question: SurveyBuilderQuestion) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((item, itemIndex) => itemIndex === index ? question : item),
    }));
  };

  const addQuestion = (type: SurveyBuilderQuestion["type"]) => {
    const base = {
      id: crypto.randomUUID(),
      labelEn: "",
      labelAr: "",
      helpTextEn: "",
      helpTextAr: "",
      required: false,
    };
    const question: SurveyBuilderQuestion = type === "rating"
      ? { ...base, type, ratingMin: 1, ratingMax: 5, ratingScale: null }
      : type === "text"
        ? { ...base, type, textMaxLength: 1000 }
        : {
            ...base,
            type,
            allowMultiple: false,
            options: [
              { id: crypto.randomUUID(), labelEn: "", labelAr: "" },
              { id: crypto.randomUUID(), labelEn: "", labelAr: "" },
            ],
          };
    setDraft((current) => ({ ...current, questions: [...current.questions, question] }));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    setDraft((current) => ({ ...current, questions }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={saveSurveyDraft} className="grid gap-5">
        <input type="hidden" name="definition" value={JSON.stringify(draft)} />
        <section className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2">
          <h2 className="text-base font-semibold text-foreground sm:col-span-2">Survey details</h2>
          <BuilderField label="English title" value={draft.titleEn} onChange={(titleEn) => setDraft({ ...draft, titleEn })} required />
          <BuilderField label="Arabic title (optional)" value={draft.titleAr} onChange={(titleAr) => setDraft({ ...draft, titleAr })} dir="rtl" />
          <BuilderArea label="English description" value={draft.descriptionEn} onChange={(descriptionEn) => setDraft({ ...draft, descriptionEn })} />
          <BuilderArea label="Arabic description" value={draft.descriptionAr} onChange={(descriptionAr) => setDraft({ ...draft, descriptionAr })} dir="rtl" />
          <BuilderField label="English thank-you message" value={draft.thankYouEn} onChange={(thankYouEn) => setDraft({ ...draft, thankYouEn })} />
          <BuilderField label="Arabic thank-you message" value={draft.thankYouAr} onChange={(thankYouAr) => setDraft({ ...draft, thankYouAr })} dir="rtl" />
          <label className="grid gap-2 text-sm font-semibold">
            Default language
            <select className={controlClass} value={draft.defaultLocale} onChange={(event) => setDraft({ ...draft, defaultLocale: event.target.value as "en" | "ar" })}>
              <option value="en">English</option><option value="ar">العربية</option>
            </select>
          </label>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Assigned locations</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {locations.map((location) => (
                <label key={location.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.locationIds.includes(location.id)}
                    onChange={(event) => setDraft({
                      ...draft,
                      locationIds: event.target.checked
                        ? [...draft.locationIds, location.id]
                        : draft.locationIds.filter((id) => id !== location.id),
                    })}
                  />
                  <span>{location.nameEn}<span className="ms-2 text-muted" dir="rtl">{location.nameAr}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-foreground">Questions</h2><p className="text-xs text-muted">Order controls the public form and response detail.</p></div>
            <div className="flex flex-wrap gap-2">
              {(["rating", "multiple_choice", "text"] as const).map((type) => (
                <button key={type} type="button" onClick={() => addQuestion(type)} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-brand">
                  + {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          {draft.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">Add the first question to make this survey publishable.</div>
          ) : null}
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              onChange={(next) => updateQuestion(index, next)}
              onRemove={() => setDraft({ ...draft, questions: draft.questions.filter((_, itemIndex) => itemIndex !== index) })}
              onMove={(direction) => move(index, direction)}
            />
          ))}
        </section>

        {!parsed.success ? (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {parsed.error.issues.slice(0, 5).map((issue) => <p key={`${issue.path.join(".")}-${issue.message}`}>{issue.path.join(" → ")}: {issue.message}</p>)}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => setShowPreview((value) => !value)} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-brand">{showPreview ? "Hide preview" : "Preview"}</button>
          <button disabled={!parsed.success} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50" type="submit">Save draft</button>
        </div>
      </form>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        {showPreview ? <SurveyPreview draft={draft} locale={locale} onLocale={setLocale} /> : (
          <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted">Preview the bilingual customer experience before publishing.</div>
        )}
      </aside>
    </div>
  );
}

function QuestionEditor({ question, index, onChange, onRemove, onMove }: {
  question: SurveyBuilderQuestion;
  index: number;
  onChange: (question: SurveyBuilderQuestion) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{index + 1}. {question.type.replace("_", " ")}</h3>
        <div className="flex gap-1">
          <button type="button" aria-label="Move question up" onClick={() => onMove(-1)} className="rounded-lg border px-2 py-1">↑</button>
          <button type="button" aria-label="Move question down" onClick={() => onMove(1)} className="rounded-lg border px-2 py-1">↓</button>
          <button type="button" onClick={onRemove} className="rounded-lg border border-red-200 px-2 py-1 text-red-700">Remove</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <BuilderField label="English label" value={question.labelEn} onChange={(labelEn) => onChange({ ...question, labelEn })} required />
        <BuilderField label="Arabic label" value={question.labelAr} onChange={(labelAr) => onChange({ ...question, labelAr })} dir="rtl" />
        <BuilderField label="English help text" value={question.helpTextEn} onChange={(helpTextEn) => onChange({ ...question, helpTextEn })} />
        <BuilderField label="Arabic help text" value={question.helpTextAr} onChange={(helpTextAr) => onChange({ ...question, helpTextAr })} dir="rtl" />
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={question.required} onChange={(event) => onChange({ ...question, required: event.target.checked })} /> Required</label>
      {question.type === "rating" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Minimum" value={question.ratingMin} onChange={(ratingMin) => onChange({ ...question, ratingMin })} />
          <NumberField label="Maximum" value={question.ratingMax} onChange={(ratingMax) => onChange({ ...question, ratingMax })} />
        </div>
      ) : null}
      {question.type === "text" ? <NumberField label="Maximum text length" value={question.textMaxLength} onChange={(textMaxLength) => onChange({ ...question, textMaxLength })} /> : null}
      {question.type === "multiple_choice" ? (
        <div className="grid gap-3">
          <p className="text-sm font-semibold">Single-choice options</p>
          {question.options.map((option, optionIndex) => (
            <div key={option.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input aria-label={`Option ${optionIndex + 1} English`} className={controlClass} value={option.labelEn} onChange={(event) => onChange({ ...question, options: question.options.map((item, index) => index === optionIndex ? { ...item, labelEn: event.target.value } : item) })} />
              <input aria-label={`Option ${optionIndex + 1} Arabic`} dir="rtl" className={controlClass} value={option.labelAr} onChange={(event) => onChange({ ...question, options: question.options.map((item, index) => index === optionIndex ? { ...item, labelAr: event.target.value } : item) })} />
              <div className="flex gap-1">
                <button type="button" aria-label="Move option up" onClick={() => onChange({ ...question, options: moveItem(question.options, optionIndex, -1) })}>↑</button>
                <button type="button" aria-label="Move option down" onClick={() => onChange({ ...question, options: moveItem(question.options, optionIndex, 1) })}>↓</button>
                <button type="button" aria-label="Remove option" onClick={() => onChange({ ...question, options: question.options.filter((_, index) => index !== optionIndex) })}>×</button>
              </div>
            </div>
          ))}
          <button type="button" className="justify-self-start rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => onChange({ ...question, options: [...question.options, { id: crypto.randomUUID(), labelEn: "", labelAr: "" }] })}>Add option</button>
        </div>
      ) : null}
    </article>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function SurveyPreview({ draft, locale, onLocale }: { draft: SurveyDraft; locale: "en" | "ar"; onLocale: (locale: "en" | "ar") => void }) {
  const pick = (en: string, ar: string) => locale === "ar" ? ar || en : en;
  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="grid gap-4 rounded-xl border border-border bg-white p-5 shadow-lg">
      <div className="flex justify-end gap-2"><button type="button" onClick={() => onLocale("en")} className="text-sm font-semibold">EN</button><button type="button" onClick={() => onLocale("ar")} className="text-sm font-semibold">العربية</button></div>
      <h2 className="text-2xl font-bold">{pick(draft.titleEn, draft.titleAr) || "Untitled survey"}</h2>
      <p className="text-sm text-muted">{pick(draft.descriptionEn, draft.descriptionAr)}</p>
      {draft.questions.map((question, index) => <div key={question.id} className="border-t border-border pt-4"><p className="font-semibold">{index + 1}. {pick(question.labelEn, question.labelAr)} {question.required ? "*" : ""}</p><p className="mt-1 text-xs text-muted">{pick(question.helpTextEn, question.helpTextAr)}</p></div>)}
    </div>
  );
}

const controlClass = "min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
function BuilderField({ label, value, onChange, dir, required }: { label: string; value: string; onChange: (value: string) => void; dir?: "rtl"; required?: boolean }) { return <label className="grid gap-1.5 text-sm font-medium text-foreground">{label}<input className={controlClass} dir={dir} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>; }
function BuilderArea({ label, value, onChange, dir }: { label: string; value: string; onChange: (value: string) => void; dir?: "rtl" }) { return <label className="grid gap-1.5 text-sm font-medium text-foreground">{label}<textarea className={`${controlClass} min-h-20`} dir={dir} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="grid gap-1.5 text-sm font-medium text-foreground">{label}<input className={controlClass} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
