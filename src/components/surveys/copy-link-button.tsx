"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  value: string;
  labelEn: string;
  labelAr?: string;
  copiedLabelEn: string;
  copiedLabelAr?: string;
};

export function CopyLinkButton({ value, labelEn, labelAr, copiedLabelEn, copiedLabelAr }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const label = copied
    ? copiedLabelAr
      ? `${copiedLabelEn} · ${copiedLabelAr}`
      : copiedLabelEn
    : labelAr
      ? `${labelEn} · ${labelAr}`
      : labelEn;
  return (
    <button
      type="button"
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-brand"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {label}
    </button>
  );
}
