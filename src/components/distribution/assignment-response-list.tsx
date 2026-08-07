"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import {
  RESPONSE_PAGE_LIMITS,
  normalizeResponseEnvelope,
  resolveResponseListError,
  type ResponseEvent,
  type ResponseListEnvelope,
} from "@/features/distribution/responses";

import { ResponseDetailDrawer } from "./response-detail-drawer";

interface AssignmentResponseListProps {
  /** Opaque assignment UUID — the only identifier the client sends to the API. */
  assignmentId: string;
  /** Display label for the employee / location this assignment belongs to. */
  subjectLabel: string;
  /** Optional locale for timestamp formatting. */
  locale?: string;
}

const PAGE_LIMIT = RESPONSE_PAGE_LIMITS.default;
const COMMENT_PREVIEW_MAX = 96;
const FALLBACK_CHANNEL = "Email Signature";

/* -------------------------------------------------------------------------- */
/*  Pure presentation helpers                                                  */
/* -------------------------------------------------------------------------- */

function formatDateTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function truncate(value: string | null, max = COMMENT_PREVIEW_MAX): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

/**
 * Customer identity is only ever surfaced for self-reported responses. Anonymous
 * responses must never be promoted into identified records, so we fall back to
 * the "Anonymous" label without touching any follow-up PII.
 */
function getCustomerDisplayName(event: ResponseEvent): string {
  const followup = event.followup;
  if (followup && followup.identity_status === "self_reported") {
    return followup.customer_name ?? followup.customer_email ?? "Customer";
  }
  return "Anonymous";
}

function isAnonymous(event: ResponseEvent): boolean {
  return event.followup?.identity_status !== "self_reported";
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type BadgeTone = "success" | "warning" | "neutral" | "brand";

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  neutral: "bg-surface-muted text-muted ring-border",
  brand: "bg-brand-light text-brand ring-brand/20",
};

function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function followUpBadge(event: ResponseEvent): { label: string; tone: BadgeTone } | null {
  const status = event.followup?.follow_up_status;
  if (!status) return null;
  const tone: BadgeTone =
    status === "submitted" || status === "completed" ? "success" : "neutral";
  return { label: humanize(status), tone };
}

function contactBadge(event: ResponseEvent): { label: string; tone: BadgeTone } | null {
  const followup = event.followup;
  if (!followup) return null;
  if (followup.contact_status === "resolved") {
    return { label: "Contact resolved", tone: "success" };
  }
  if (followup.contact_requested) {
    return { label: "Follow-up requested", tone: "warning" };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Data fetching (framework-agnostic, no state mutation inside)               */
/* -------------------------------------------------------------------------- */

type FetchResult =
  | { ok: true; envelope: ResponseListEnvelope }
  | { ok: false; message: string };

async function fetchResponsePage(
  assignmentId: string,
  offset: number,
  signal: AbortSignal,
): Promise<FetchResult> {
  try {
    const res = await fetch(
      `/api/email-signature/responses/${encodeURIComponent(assignmentId)}?limit=${PAGE_LIMIT}&offset=${offset}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal,
      },
    );

    if (!res.ok) {
      let reason = "unknown";
      try {
        const body: unknown = await res.json();
        if (
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
        ) {
          reason = (body as { error: string }).error;
        }
      } catch {
        /* response had no JSON body — keep the generic reason */
      }
      return { ok: false, message: resolveResponseListError(reason) };
    }

    const envelope = normalizeResponseEnvelope(await res.json());
    return { ok: true, envelope };
  } catch {
    // AbortError included — callers guard on signal.aborted before dispatching.
    return { ok: false, message: resolveResponseListError("network") };
  }
}

/* -------------------------------------------------------------------------- */
/*  Reducer — one atomic update per transition (no multi-setState races)       */
/* -------------------------------------------------------------------------- */

type Status = "loading" | "ready" | "loadingMore" | "error";

interface State {
  status: Status;
  events: ResponseEvent[];
  total: number;
  channel: string | null;
  /** Row offset for the next page request (== number of rows already loaded). */
  offset: number;
  error: string | null;
}

type Action =
  | { type: "reset" }
  | { type: "loadMoreStart" }
  | { type: "loadSuccess"; envelope: ResponseListEnvelope; append: boolean }
  | { type: "loadError"; message: string }
  | { type: "loadMoreError"; message: string };

const INITIAL_STATE: State = {
  status: "loading",
  events: [],
  total: 0,
  channel: null,
  offset: 0,
  error: null,
};

function dedupeById(existing: ResponseEvent[], incoming: ResponseEvent[]): ResponseEvent[] {
  const seen = new Set(existing.map((event) => event.id));
  const merged = existing.slice();
  for (const event of incoming) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      merged.push(event);
    }
  }
  return merged;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return INITIAL_STATE;
    case "loadMoreStart":
      return { ...state, status: "loadingMore", error: null };
    case "loadSuccess": {
      const events = action.append
        ? dedupeById(state.events, action.envelope.events)
        : action.envelope.events;
      return {
        status: "ready",
        events,
        total: action.envelope.total,
        channel: action.envelope.channel,
        offset: events.length,
        error: null,
      };
    }
    case "loadError":
      return { ...state, status: "error", error: action.message };
    case "loadMoreError":
      // Keep existing rows visible; surface the failure on the load-more control.
      return { ...state, status: "ready", error: action.message };
    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export function AssignmentResponseList({
  assignmentId,
  subjectLabel,
  locale = "en",
}: AssignmentResponseListProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const loadMoreController = useRef<AbortController | null>(null);

  // Initial load (and explicit retry via reloadKey). No state is written
  // synchronously inside the effect body: the reducer is only dispatched after
  // the awaited fetch resolves, which keeps `react-hooks/set-state-in-effect`
  // satisfied. `assignmentId` is stable per mount (the parent keys on it).
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const result = await fetchResponsePage(assignmentId, 0, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok) {
        dispatch({ type: "loadSuccess", envelope: result.envelope, append: false });
      } else {
        dispatch({ type: "loadError", message: result.message });
      }
    })();
    return () => controller.abort();
  }, [assignmentId, reloadKey]);

  // Abort any in-flight load-more request on unmount. This cleanup never writes state.
  useEffect(() => {
    return () => loadMoreController.current?.abort();
  }, []);

  const handleRetry = () => {
    dispatch({ type: "reset" });
    setReloadKey((key) => key + 1);
  };

  const handleLoadMore = () => {
    if (state.status === "loadingMore") return;
    loadMoreController.current?.abort();
    const controller = new AbortController();
    loadMoreController.current = controller;
    dispatch({ type: "loadMoreStart" });
    void (async () => {
      const result = await fetchResponsePage(assignmentId, state.offset, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok) {
        dispatch({ type: "loadSuccess", envelope: result.envelope, append: true });
      } else {
        dispatch({ type: "loadMoreError", message: result.message });
      }
    })();
  };

  const { status, events, total, channel, error } = state;
  const channelLabel = channel ?? FALLBACK_CHANNEL;
  const hasMore = events.length < total;

  /* ----- Full-panel states (no rows to preserve) ----- */

  if (status === "loading" && events.length === 0) {
    return (
      <div
        className="flex flex-col items-center rounded-xl border border-border bg-surface p-10 text-center"
        data-testid="responses-list-loading"
        aria-busy="true"
      >
        <div
          className="size-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm text-muted">Loading responses…</p>
      </div>
    );
  }

  if (status === "error" && events.length === 0) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-border bg-surface p-10 text-center"
        data-testid="responses-list-error"
      >
        <p className="text-sm font-medium text-danger">{error}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 inline-flex items-center rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "ready" && events.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-surface p-10 text-center"
        data-testid="responses-list-empty"
      >
        <p className="text-sm font-medium text-foreground">No responses yet</p>
        <p className="mt-1 text-xs text-muted">
          Responses appear here as recipients rate {subjectLabel}.
        </p>
      </div>
    );
  }

  /* ----- Loaded table (rows preserved across load-more) ----- */

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface" data-testid="responses-list">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Recent responses</h3>
        <div className="flex items-center gap-2 text-xs text-muted">
          <StatusBadge tone="brand">{channelLabel}</StatusBadge>
          <span aria-hidden="true">·</span>
          <span>
            {total} response{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-start text-sm">
          <caption className="sr-only">Responses for {subjectLabel}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-start text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Submitted</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Customer</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Rating</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Comment</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Follow-up</th>
              <th scope="col" className="px-4 py-2.5 text-start font-semibold">Contact</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const followUp = followUpBadge(event);
              const contact = contactBadge(event);
              const comment = truncate(event.followup?.comment ?? null);
              const anonymous = isAnonymous(event);
              return (
                <tr
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View response from ${getCustomerDisplayName(event)} for ${subjectLabel}`}
                  onClick={() => setDrawerOpen(true)}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      setDrawerOpen(true);
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-surface-muted/50 focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-muted">
                    {formatDateTime(event.created_at, locale)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={anonymous ? "text-muted" : "font-medium text-foreground"}>
                      {getCustomerDisplayName(event)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      {event.emoji ? (
                        <span className="text-base leading-none" aria-hidden="true">
                          {event.emoji}
                        </span>
                      ) : null}
                      <span>{event.rating}/5</span>
                      {event.label ? (
                        <span className="text-xs font-normal text-muted">{event.label}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="max-w-[18rem] px-4 py-3 align-middle text-muted">
                    {comment ? (
                      <span className="line-clamp-2">{comment}</span>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    {followUp ? (
                      <StatusBadge tone={followUp.tone}>{followUp.label}</StatusBadge>
                    ) : (
                      <span className="text-muted" aria-hidden="true">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    {contact ? (
                      <StatusBadge tone={contact.tone}>{contact.label}</StatusBadge>
                    ) : (
                      <span className="text-muted" aria-hidden="true">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(hasMore || error) && (
        <div className="border-t border-border px-4 py-3">
          {error ? (
            <p role="alert" className="mb-2 text-center text-xs text-danger">
              {error}
            </p>
          ) : null}
          {hasMore ? (
            <div className="text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={status === "loadingMore"}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="responses-load-more"
              >
                {status === "loadingMore" ? (
                  <>
                    <span
                      className="size-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
                      aria-hidden="true"
                    />
                    Loading…
                  </>
                ) : error ? (
                  "Try again"
                ) : (
                  `Load more (${events.length} of ${total})`
                )}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <ResponseDetailDrawer
        assignmentId={assignmentId}
        subjectLabel={subjectLabel}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        locale={locale}
      />
    </div>
  );
}
