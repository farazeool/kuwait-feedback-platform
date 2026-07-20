"use client";

export default function LocationsError({ reset }: { error: Error; reset: () => void }) {
  return <section className="rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Location analytics unavailable</h1><p className="mt-2 text-muted">The permission-scoped report could not be loaded safely.</p><button type="button" onClick={reset} className="mt-5 rounded-xl bg-brand px-4 py-2 font-bold text-white">Try again</button></section>;
}
