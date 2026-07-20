"use client";
export default function ResponseError({ reset }: { reset: () => void }) { return <div className="rounded-2xl bg-red-50 p-6 text-red-800"><h2 className="font-bold">Responses could not be loaded</h2><button onClick={reset} className="mt-4 rounded-xl border border-red-200 px-4 py-2">Retry</button></div>; }
