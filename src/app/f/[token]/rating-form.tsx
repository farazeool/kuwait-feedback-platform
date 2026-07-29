"use client";

import { useState } from "react";
import { submitRating } from "@/features/distribution/rating";

const EMOJI_OPTIONS: Record<string, { label: string; value: number }[]> = {
  emoji: [
    { label: "😞", value: 1 },
    { label: "😕", value: 2 },
    { label: "😐", value: 3 },
    { label: "🙂", value: 4 },
    { label: "😄", value: 5 },
  ],
  star: [
    { label: "★", value: 1 },
    { label: "★★", value: 2 },
    { label: "★★★", value: 3 },
    { label: "★★★★", value: 4 },
    { label: "★★★★★", value: 5 },
  ],
  three_option: [
    { label: "👎", value: 1 },
    { label: "😐", value: 3 },
    { label: "👍", value: 5 },
  ],
  yes_no: [
    { label: "👎 No", value: 1 },
    { label: "👍 Yes", value: 5 },
  ],
};

export default function RatingForm({
  token,
  nonce,
  ratingStyle,
  initialRating,
}: {
  token: string;
  nonce: string;
  ratingStyle: string;
  initialRating?: string;
}) {
  // Parse and validate initial rating from query param (1-5)
  const parsedInitial = initialRating ? parseInt(initialRating, 10) : null;
  const validInitial = parsedInitial && parsedInitial >= 1 && parsedInitial <= 5 ? parsedInitial : null;

  const [selected, setSelected] = useState<number | null>(validInitial);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const options = EMOJI_OPTIONS[ratingStyle] ?? EMOJI_OPTIONS.emoji;

  async function handleSelect(value: number) {
    if (submitted || loading) return;
    setSelected(value);
    setLoading(true);
    const result = await submitRating({ token, rating: value, nonce });
    setLoading(false);
    if (result.ok) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold text-foreground">Thank you!</p>
        <p className="mt-1 text-sm text-muted">Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {options.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          disabled={loading}
          aria-label={`Rate ${value} out of 5`}
          className={`rounded-xl border px-4 py-3 text-2xl transition-colors ${
            selected === value
              ? "border-brand bg-brand/10"
              : "border-border bg-white hover:border-brand hover:bg-brand/5"
          } disabled:opacity-50`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
