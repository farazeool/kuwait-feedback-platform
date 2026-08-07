"use client";

import { useState } from "react";

type Props = {
  html: string;
  title?: string;
};

/**
 * View/copy raw HTML code for manual pasting.
 * Useful when rich clipboard fails or user needs to see the code.
 */
export function ViewHtmlCode({ html, title = "HTML Code" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(html);
      } else {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = html;
        ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-foreground"
      >
        View HTML code
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-brand px-3 py-1 text-xs font-medium text-brand hover:bg-brand/5"
          >
            {copied ? "✓ Copied" : "Copy code"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted hover:border-red-300 hover:text-red-600"
          >
            Close
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
        <code>{html}</code>
      </pre>
      <p className="mt-2 text-xs text-muted">
        Select all and copy if the copy button doesn&apos;t work in your browser.
      </p>
    </div>
  );
}
