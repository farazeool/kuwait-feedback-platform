"use client";

import { useState } from "react";

type Props = {
  html: string;
  plainText: string;
  label?: string;
};

/**
 * Copy email signature to clipboard with both HTML and plain text MIME types.
 * Falls back to plain text if rich clipboard is unavailable.
 */
export function CopySignatureButton({ html, plainText, label = "Copy signature" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      // Attempt rich clipboard write (text/html + text/plain)
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        const item = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([item]);
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      // Fallback: copy plain text only
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
        return;
      }

      // Oldest fallback: execCommand
      const ta = document.createElement("textarea");
      ta.value = plainText;
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        setState("copied");
        setTimeout(() => setState("idle"), 2000);
      } else {
        setState("failed");
        setTimeout(() => setState("idle"), 3000);
      }
    } catch (err) {
      console.error("Copy failed:", err);
      setState("failed");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
        state === "copied"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : state === "failed"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-brand bg-brand text-white hover:bg-brand/90"
      }`}
    >
      {state === "copied" ? "✓ Copied!" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
