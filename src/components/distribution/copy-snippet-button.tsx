"use client";

import { useState } from "react";

type Props = { appUrl: string; publicToken: string };

function copyText(text: string): boolean {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  // Older-browser fallback via execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopySnippetButton({ appUrl, publicToken }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const snippet =
      `<a href="${appUrl}/f/${publicToken}">` +
      `<img src="${appUrl}/api/signature-image/${publicToken}.png" alt="Rate your experience" />` +
      `</a>`;
    copyText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-brand"
      onClick={handleClick}
    >
      {copied ? "Copied!" : "Copy snippet"}
    </button>
  );
}
