"use client";
export default function TeamError({ reset }: { error: Error; reset: () => void }) { return <section className="rounded-3xl border border-border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Team unavailable</h1><button className="mt-4 rounded-xl bg-brand px-4 py-2 text-white" onClick={reset}>Try again</button></section>; }
