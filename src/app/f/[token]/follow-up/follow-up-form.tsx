"use client";

import { useState } from "react";

import { submitRatingFollowup } from "@/features/distribution/rating";

const RATING_OPTIONS = [
  { emoji: "😡", label: "Bad", accessibleLabel: "Bad — very dissatisfied", value: 1 },
  { emoji: "😞", label: "Poor", accessibleLabel: "Poor — dissatisfied", value: 2 },
  { emoji: "😐", label: "Average", accessibleLabel: "Average — neutral", value: 3 },
  { emoji: "🙂", label: "Good", accessibleLabel: "Good — satisfied", value: 4 },
  { emoji: "😊", label: "Excellent", accessibleLabel: "Excellent — very satisfied", value: 5 },
];

const FOLLOW_UP_COPY: Record<number, { heading: string; question: string }> = {
  1: { heading: "We’re sorry this went badly.", question: "What happened, and what could we do to make it right?" },
  2: { heading: "We’re sorry we fell short.", question: "What could we have done better?" },
  3: { heading: "Thank you for your feedback.", question: "What would have made your experience better?" },
  4: { heading: "Thank you—we’re glad it went well.", question: "What did the team do well, and what could make the experience even better?" },
  5: { heading: "Great to hear!", question: "What made your experience excellent?" },
};

export default function FollowUpForm({
  token,
  continuationToken,
  ratingValue,
  ratingLabel,
  ratingEmoji,
  organizationName,
  employeeName,
  locationName,
  initialName,
  initialEmail,
  initialComment,
}: {
  token: string;
  continuationToken: string;
  ratingValue: number;
  ratingLabel: string;
  ratingEmoji: string;
  organizationName?: string;
  employeeName?: string;
  locationName?: string;
  initialName?: string;
  initialEmail?: string;
  initialComment?: string;
}) {
  const [selected, setSelected] = useState<number>(ratingValue);
  const [customerName, setCustomerName] = useState(initialName ?? "");
  const [customerEmail, setCustomerEmail] = useState(initialEmail ?? "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [contactRequested, setContactRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const followUpCopy = FOLLOW_UP_COPY[selected];

  async function save(skip = false) {
    if (submitting || done) return;
    if (!skip && contactRequested && !customerEmail.trim()) {
      setStatusMessage("Please add an email address if you want us to contact you.");
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    const result = await submitRatingFollowup({
      token,
      continuationToken,
      rating: selected,
      customerName,
      customerEmail,
      comment,
      contactRequested: skip ? false : contactRequested,
      skip,
    });
    setSubmitting(false);

    if (!result.ok) {
      setStatusMessage("We could not save this update. Please try again.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl bg-brand/5 p-5 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold text-foreground">Thanks for the extra detail.</p>
        <p className="mt-1 text-sm text-muted">
          {contactRequested ? "Our team will follow up soon." : "Your feedback is saved."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <div className="grid gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{followUpCopy.heading}</h1>
          <p className="mt-1 text-sm text-muted">{followUpCopy.question}</p>
        </div>
        <p className="text-sm font-medium text-muted">You selected {ratingEmoji} {ratingLabel}. You can change it now if needed.</p>
        <div className="grid grid-cols-5 gap-2">
          {RATING_OPTIONS.map(({ emoji, label, accessibleLabel, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              aria-label={accessibleLabel}
              aria-pressed={selected === value}
              className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-colors ${
                selected === value
                  ? "border-brand bg-brand/10"
                  : "border-border bg-white hover:border-brand hover:bg-brand/5"
              }`}
            >
              <span className="text-2xl leading-none">{emoji}</span>
              <span className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-white p-4">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Name (optional)
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            type="text"
            maxLength={120}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            placeholder="Your name"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          Email {contactRequested ? <span className="text-brand">(required for contact)</span> : <span className="text-muted">(optional)</span>}
          <input
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            type="email"
            maxLength={320}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            placeholder="name@example.com"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-foreground">
          Comment (optional)
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            maxLength={2000}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            placeholder={followUpCopy.question}
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-foreground">
          <input
            checked={contactRequested}
            onChange={(event) => setContactRequested(event.target.checked)}
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand"
          />
          <span>
            <span className="block font-medium">Please contact me about this feedback</span>
            <span className="block text-muted">Your address will only be used to follow up on this feedback.</span>
          </span>
        </label>
      </div>

      {statusMessage ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{statusMessage}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand px-5 py-3 font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Submit feedback"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void save(true);
          }}
          className="rounded-xl border border-border bg-white px-5 py-3 font-semibold text-foreground transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          Skip
        </button>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">
        <p className="font-medium text-foreground">{organizationName ?? "Feedback"}</p>
        <p className="mt-1">
          {employeeName ? `You are helping ${employeeName}${locationName ? ` at ${locationName}` : ""}.` : "Your first rating is already محفوظ. This page only adds optional detail."}
        </p>
      </div>
    </form>
  );
}