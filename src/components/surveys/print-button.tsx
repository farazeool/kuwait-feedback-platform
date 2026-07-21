"use client";

export function PrintButton({ labelEn, labelAr }: { labelEn: string; labelAr: string }) {
  return (
    <button
      type="button"
      className="rounded-xl bg-brand px-4 py-2 font-semibold text-white print:hidden"
      onClick={() => window.print()}
    >
      {labelEn} · {labelAr}
    </button>
  );
}
