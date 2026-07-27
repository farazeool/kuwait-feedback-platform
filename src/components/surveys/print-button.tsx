"use client";

export function PrintButton({ labelEn, labelAr }: { labelEn: string; labelAr?: string }) {
  return (
    <button
      type="button"
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark print:hidden"
      onClick={() => window.print()}
    >
      {labelAr ? `${labelEn} · ${labelAr}` : labelEn}
    </button>
  );
}
