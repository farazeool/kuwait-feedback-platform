"use client";

import { useState } from "react";

interface EmailSignatureBuilderProps {
  surveyId: string;
  publicSlug: string;
  organizationName: { en: string; ar: string };
  appUrl: string;
  brandColor?: string;
}

export function EmailSignatureBuilder({
  surveyId,
  publicSlug,
  organizationName,
  appUrl,
  brandColor = "#2563eb",
}: EmailSignatureBuilderProps) {
  const [ratingStyle, setRatingStyle] = useState<"emoji" | "star">("emoji");
  const [copied, setCopied] = useState(false);

  const feedbackUrl = `${appUrl}/feedback/${encodeURIComponent(publicSlug)}?ch=email`;

  const emojiHtml = `<a href="${feedbackUrl.replace(/&/g, "&amp;")}" style="display:inline-block;text-decoration:none;font-size:20px;line-height:1;padding:4px 0;letter-spacing:3px;" target="_blank">
  &#128522; &#128578; &#128528; &#128542; &#128545;
  <span style="display:block;font-size:11px;color:#666;margin-top:2px;">${organizationName.en} &mdash; How did we do? Tap to rate</span>
</a>`;

  const starHtml = `<a href="${feedbackUrl.replace(/&/g, "&amp;")}" style="display:inline-block;text-decoration:none;color:${brandColor};font-size:18px;line-height:1;padding:4px 0;" target="_blank">
  &#9733;&#9733;&#9733;&#9733;&#9733;
  <span style="display:block;font-size:11px;color:#666;margin-top:2px;">${organizationName.en} &mdash; How did we do? Tap to rate</span>
</a>`;

  const currentHtml = ratingStyle === "emoji" ? emojiHtml : starHtml;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea
      const textarea = document.getElementById("signature-html-output") as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  return (
    <div className="grid gap-5 rounded-xl border border-border bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Email Signature Builder</h2>
        <p className="mt-0.5 text-xs text-muted">Generate an email-friendly feedback link for your team&apos;s signatures</p>
      </div>

      <label className="grid gap-1 text-sm font-semibold">
        Rating style
        <select value={ratingStyle} onChange={(e) => setRatingStyle(e.target.value as "emoji" | "star")} className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="emoji">Emoji (😊 🙂 😐 ☹ 😡)</option>
          <option value="star">Stars (★★★★★)</option>
        </select>
      </label>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
        <div className="rounded bg-white p-3 text-sm" dangerouslySetInnerHTML={{ __html: currentHtml }} />
      </div>

      {/* HTML Output */}
      <div className="grid gap-1">
        <label htmlFor="signature-html-output" className="text-sm font-semibold">
          HTML code
        </label>
        <textarea
          id="signature-html-output"
          readOnly
          value={currentHtml}
          rows={4}
          className="w-full rounded-lg border border-border bg-gray-50 p-2.5 font-mono text-xs"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleCopy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
          {copied ? "Copied!" : "Copy HTML"}
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([currentHtml], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `email-signature-${publicSlug.slice(0, 8)}.html`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-brand"
        >
          Download template
        </button>
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-brand"
        >
          Preview as customer
        </a>
      </div>

      {/* Usage instructions */}
      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        <p className="font-semibold">How to use:</p>
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>Choose your rating style (emoji or stars)</li>
          <li>Copy the HTML code</li>
          <li>Paste it into your email signature settings (Gmail, Outlook, etc.)</li>
          <li>Each email you send will now include a feedback link</li>
        </ol>
      </div>
    </div>
  );
}
