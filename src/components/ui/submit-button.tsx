"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms.
 *
 * Uses `useFormStatus` to reflect the pending state of the enclosing <form>:
 * it disables itself (preventing double-submit) and shows a spinner + pending
 * label while the server action runs. The form and its action stay entirely
 * server-side — this only adds client-side feedback, no behavioural change.
 *
 * Must be rendered as a descendant of a <form> with a server `action`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  className = "rounded-lg bg-brand px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="size-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
