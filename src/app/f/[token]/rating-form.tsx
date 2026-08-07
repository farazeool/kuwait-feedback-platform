"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitRating } from "@/features/distribution/rating";

const RATING_OPTIONS = [
  { emoji: "😡", label: "Bad", value: 1 },
  { emoji: "😞", label: "Poor", value: 2 },
  { emoji: "😐", label: "Average", value: 3 },
  { emoji: "🙂", label: "Good", value: 4 },
  { emoji: "😊", label: "Excellent", value: 5 },
];

export default function RatingForm({
  token,
  nonce,
  initialRating,
  organizationName,
  employeeName,
  locationName,
}: {
  token: string;
  nonce: string;
  initialRating?: string;
  organizationName?: string;
  employeeName?: string;
  locationName?: string;
}) {
  const router = useRouter();
  // Parse and validate initial rating from query param (1-5)
  const parsedInitial = initialRating ? parseInt(initialRating, 10) : null;
  const validInitial = parsedInitial && parsedInitial >= 1 && parsedInitial <= 5 ? parsedInitial : null;

  const [selected, setSelected] = useState<number | null>(validInitial);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(value: number) {
    if (loading) return;
    setSelected(value);
    setLoading(true);
    setError(null);
    const result = await submitRating({ token, rating: value, nonce });
    setLoading(false);
    if (result.ok) {
      if (result.continuationToken) {
        router.push(`/f/${token}/follow-up?ct=${result.continuationToken}`);
        return;
      }

      setSubmitted(true);
    } else {
      setError("Unable to submit feedback. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 rounded-2xl bg-brand/5 p-5 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold text-foreground">Thank you!</p>
        <p className="mt-1 text-sm text-muted">Your response has been recorded.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 text-center">
        <p className="text-2xl">⚠️</p>
        <p className="mt-2 font-semibold text-foreground">Something went wrong</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setSelected(null);
          }}
          className="mt-4 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      <div className="grid grid-cols-5 gap-2">
        {RATING_OPTIONS.map(({ emoji, label, value }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          disabled={loading}
          aria-label={`${emoji} ${label}`}
          className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-colors ${
            selected === value
              ? "border-brand bg-brand/10"
              : "border-border bg-white hover:border-brand hover:bg-brand/5"
          } disabled:opacity-50`}
        >
          <span className="text-2xl leading-none">{emoji}</span>
          <span className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">{label}</span>
        </button>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-muted">
        <p className="font-medium text-foreground">{organizationName ?? "Feedback"}</p>
        <p className="mt-1">
          {employeeName ? `You are rating ${employeeName}${locationName ? ` at ${locationName}` : ""}.` : "Choose the emoji that best matches your experience."}
        </p>
      </div>
    </div>
  );
}
