"use client";

import { useState } from "react";
import { CopySignatureButton } from "./copy-signature-button";

type Props = {
  html: string;
  plainText: string;
  feedbackLink: string;
  employeeName: string;
};

/**
 * Install Signature dialog that provides:
 * 1. Copy Signature button (HTML + plain text)
 * 2. Copy Feedback Link button
 * 3. View HTML button
 * 4. Installation instructions for Gmail Web, Outlook Web, Outlook Desktop
 */
export function InstallSignatureDialog({ html, plainText, feedbackLink, employeeName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedbackLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      console.error("Failed to copy link");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
      >
        Install Signature
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Install Email Signature</h2>
                <p className="text-sm text-muted">For {employeeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:bg-gray-50"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Signature Preview */}
            <div className="mb-6 rounded-lg border border-border bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
              <div
                className="rounded-lg border border-border bg-white p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>

            {/* Action Buttons */}
            <div className="mb-6 flex flex-wrap gap-2">
              <CopySignatureButton html={html} plainText={plainText} label="Copy Signature" />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  linkCopied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-border bg-white text-foreground hover:bg-gray-50"
                }`}
              >
                {linkCopied ? "✓ Link Copied!" : "Copy Feedback Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowHtml(!showHtml)}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-gray-50"
              >
                {showHtml ? "Hide HTML" : "View HTML"}
              </button>
            </div>

            {/* HTML Code View */}
            {showHtml && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">HTML Code</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-gray-100 p-3 text-xs text-muted">
                  {html}
                </pre>
              </div>
            )}

            {/* Installation Instructions */}
            <div className="grid gap-4">
              <p className="text-sm font-semibold text-foreground">Installation Instructions</p>
              
              <section className="rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground">Gmail Web</h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
                  <li>Click the gear icon → See all settings</li>
                  <li>Scroll to the Signature section</li>
                  <li>Click Create new and give your signature a name</li>
                  <li>Paste the copied signature into the editor (Ctrl/Cmd+V)</li>
                  <li>Scroll to the bottom and click Save Changes</li>
                </ol>
              </section>

              <section className="rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground">Outlook Web</h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
                  <li>Click Settings (gear icon) → View all Outlook settings</li>
                  <li>Go to Mail → Compose and reply</li>
                  <li>Under Email signature, paste the copied signature</li>
                  <li>Check Automatically include my signature on messages</li>
                  <li>Click Save</li>
                </ol>
              </section>

              <section className="rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground">Outlook Desktop</h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted">
                  <li>File → Options → Mail → Signatures</li>
                  <li>Click New to create a new signature</li>
                  <li>Paste the copied signature in the edit box</li>
                  <li>Set as default for new messages and/or replies</li>
                  <li>Click OK to save</li>
                </ol>
              </section>
            </div>

            {/* Confirmation Message */}
            <div className="mt-6 rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
              After copying, paste the signature into your email client{"'"}s signature settings.
            </div>
          </div>
        </div>
      )}
    </>
  );
}