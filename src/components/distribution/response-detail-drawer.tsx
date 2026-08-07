"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  RESPONSE_PAGE_LIMITS,
  resolveResponseListError,
  type ResponseListEnvelope,
} from "@/features/distribution/responses";

interface ResponseDetailDrawerProps {
  /** Opaque assignment UUID; the only thing the client ever sends to the API. */
  assignmentId: string | null;
  /** Display label for the employee / location this assignment is for. */
  subjectLabel: string;
  /** Whether the drawer is currently visible. */
  open: boolean;
  /** Called when the user dismisses the drawer. */
  onClose: () => void;
  /** Optional locale for the timestamp formatter. */
  locale?: string;
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; envelope: ResponseListEnvelope }
  | { status: "error"; message: string };

export function ResponseDetailDrawer({
  assignmentId,
  subjectLabel,
  open,
  onClose,
  locale = "en",
}: ResponseDetailDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [state, setState] = useState<FetchState>({ status: "idle" });

  const fetchEnvelop = useCallback(async (id: string) => {
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/email-signature/responses/${encodeURIComponent(id)}?limit=${RESPONSE_PAGE_LIMITS.default}`,
        { method: "GET", headers: { Accept: "application/json" }, credentials: "same-origin" },
      );
      if (!res.ok) {
        let reason = "unknown";
        try {
          const body = (await res.json()) as { error?: string };
          reason = typeof body.error === "string" ? body.error : reason;
        } catch {
          /* ignore */
        }
        setState({ status: "error", message: resolveResponseListError(reason) });
        return;
      }
      const envelope = (await res.json()) as ResponseListEnvelope;
      setState({ status: "ready", envelope });
    } catch {
      setState({
        status: "error",
        message: resolveResponseListError("network"),
      });
    }
  }, []);

  useEffect(() => {
    if (!open || !assignmentId) return;
    // Defer the fetch start to a microtask so the synchronous `setState` inside
    // `fetchEnvelop` doesn't trip the `react-hooks/set-state-in-effect` rule.
    const handle = window.setTimeout(() => {
      void fetchEnvelop(assignmentId);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open, assignmentId, fetchEnvelop]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  if (!open) return null;
return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-foreground">Responses</h2>
            <p className="mt-1 text-sm text-muted">{subjectLabel}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Close responses drawer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {state.status === "loading" && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted" data-testid="responses-loading">
            Loading responses…
          </div>
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" data-testid="responses-error">
            {state.message}
          </div>
        )}

        {state.status === "ready" && state.envelope.events.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted" data-testid="responses-empty">
            <p>No ratings have been captured yet.</p>
            <p className="mt-1 text-xs">When a recipient clicks a rating in their signature, it will appear here.</p>
          </div>
        )}

        {state.status === "ready" && state.envelope.events.length > 0 && (
          <ReadyContent envelope={state.envelope} locale={locale} />
        )}
      </div>
    </div>
  );
}
function ReadyContent({ envelope, locale }: { envelope: ResponseListEnvelope; locale: string }) {
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="grid gap-4" data-testid="responses-ready">
      <header className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span>
            Channel: <strong className="text-foreground">{envelope.channel ?? "—"}</strong>
          </span>
          <span>
            Template: <strong className="text-foreground">{envelope.template ?? "—"}</strong>
          </span>
        </div>
        <p className="mt-1">
          {envelope.total} rating{envelope.total === 1 ? "" : "s"} total · showing{" "}
          {envelope.events.length}
        </p>
      </header>

      <ul className="grid gap-3" aria-label="Captured ratings">
        {envelope.events.map((event) => (
          <li
            key={event.id}
            className="rounded-lg border border-border bg-white p-4"
            data-testid="response-event"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  {event.emoji ?? "•"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {event.label ?? `Rating ${event.rating} / 5`}
                  </p>
                  <p className="text-xs text-muted">
                    {fmt.format(new Date(event.created_at))}
                  </p>
                </div>
              </div>
              {event.followup?.contact_requested ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                  Contact requested
                </span>
              ) : null}
            </div>

            {event.followup?.comment ? (
              <blockquote className="mt-3 rounded border border-border bg-surface-muted p-3 text-sm text-foreground">
                {event.followup.comment}
              </blockquote>
            ) : null}

            {event.followup ? <FollowupDetail followup={event.followup} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
function FollowupDetail({
  followup,
}: {
  followup: NonNullable<ResponseListEnvelope["events"][number]["followup"]>;
}) {
  // Only show PII (name / email) if the customer actually opted in via the
  // follow-up flow — anonymous ratings must not be promoted into identified
  // records in the UI.
  const hasIdentity = followup.identity_status === "self_reported";
  if (!hasIdentity && !followup.comment) return null;

  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {followup.identity_status ? (
        <>
          <dt className="text-muted">Identity</dt>
          <dd className="text-foreground">
            {followup.identity_status === "self_reported" ? "Self reported" : "Anonymous"}
          </dd>
        </>
      ) : null}
      {hasIdentity && followup.customer_name ? (
        <>
          <dt className="text-muted">Name</dt>
          <dd className="text-foreground">{followup.customer_name}</dd>
        </>
      ) : null}
      {hasIdentity && followup.customer_email ? (
        <>
          <dt className="text-muted">Email</dt>
          <dd className="text-foreground">{followup.customer_email}</dd>
        </>
      ) : null}
      {followup.follow_up_status ? (
        <>
          <dt className="text-muted">Follow-up</dt>
          <dd className="text-foreground">{followup.follow_up_status}</dd>
        </>
      ) : null}
      {followup.contact_status ? (
        <>
          <dt className="text-muted">Contact</dt>
          <dd className="text-foreground">{followup.contact_status}</dd>
        </>
      ) : null}
    </dl>
  );
}