"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  value: string;
  labelEn: string;
  labelAr: string;
  copiedLabelEn: string;
  copiedLabelAr: string;
};

export function CopyLinkButton({ value, labelEn, labelAr, copiedLabelEn, copiedLabelAr }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? `${copiedLabelEn} · ${copiedLabelAr}` : `${labelEn} · ${labelAr}`}
    </button>
  );
}
