/**
 * Pure decision logic for the "list responses for an assignment" flow.
 *
 * Mirrors `assignment-result.ts`: the React drawer stays a thin wrapper, every
 * branch that decides *what should happen* lives here so it can be unit tested
 * under the plain Node Vitest environment (no jsdom, no RTL).
 */

/** Minimum and maximum page size for the responses list. */
export const RESPONSE_PAGE_LIMITS = {
  default: 25,
  min: 1,
  max: 100,
} as const;

/** Maximum number of milliseconds the cursor can be offset before we reset to 0. */
export const RESPONSE_OFFSET_FLOOR = 0;

/** What the server endpoint should do with a list-responses request. */
export type ListResponsesDecision =
  | {
      action: "fetch";
      assignmentId: string;
      start: string | null;
      end: string | null;
      limit: number;
      offset: number;
    }
  | { action: "reject"; message: string };

export const RESPONSES_LIST_MESSAGES = {
  missingAssignment: "Assignment id is required",
  badAssignmentId: "Assignment id must be a UUID",
  invalidRange: "Start date must be before end date",
  limitTooSmall: `Page size must be at least ${RESPONSE_PAGE_LIMITS.min}`,
  limitTooLarge: `Page size must be at most ${RESPONSE_PAGE_LIMITS.max}`,
  badDate: "Dates must be valid ISO 8601 timestamps",
} as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeIsoDate(value: string): string | null {
  // Reject any input that isn't a parseable ISO timestamp and round-trips back
  // to the same value (Date() will silently coerce garbage like "foo" to NaN).
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  const normalized = new Date(ms).toISOString();
  return normalized;
}

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return RESPONSE_PAGE_LIMITS.default;
  }
  if (raw < RESPONSE_PAGE_LIMITS.min) return RESPONSE_PAGE_LIMITS.min;
  if (raw > RESPONSE_PAGE_LIMITS.max) return RESPONSE_PAGE_LIMITS.max;
  return Math.floor(raw);
}

function clampOffset(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < RESPONSE_OFFSET_FLOOR) {
    return 0;
  }
  return Math.floor(raw);
}
/**
 * Decides whether a list-responses request should reach the server.
 *
 * This is the only place that validates the URL params; the API route trusts
 * the resolved decision and forwards it to the RPC verbatim.
 */
export function decideListResponses(input: {
  assignmentId: string | null | undefined;
  start?: string | null;
  end?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
}): ListResponsesDecision {
  const assignmentId = (input.assignmentId ?? "").trim();
  if (!assignmentId) {
    return { action: "reject", message: RESPONSES_LIST_MESSAGES.missingAssignment };
  }
  if (!UUID_REGEX.test(assignmentId)) {
    return { action: "reject", message: RESPONSES_LIST_MESSAGES.badAssignmentId };
  }

  let start: string | null = null;
  let end: string | null = null;

  if (input.start) {
    const parsed = safeIsoDate(input.start);
    if (parsed === null) {
      return { action: "reject", message: RESPONSES_LIST_MESSAGES.badDate };
    }
    start = parsed;
  }
  if (input.end) {
    const parsed = safeIsoDate(input.end);
    if (parsed === null) {
      return { action: "reject", message: RESPONSES_LIST_MESSAGES.badDate };
    }
    end = parsed;
  }
  if (start && end && Date.parse(start) >= Date.parse(end)) {
    return { action: "reject", message: RESPONSES_LIST_MESSAGES.invalidRange };
  }

  const numericLimit =
    typeof input.limit === "string" && input.limit.trim() !== ""
      ? Number(input.limit)
      : typeof input.limit === "number"
        ? input.limit
        : undefined;
  const numericOffset =
    typeof input.offset === "string" && input.offset.trim() !== ""
      ? Number(input.offset)
      : typeof input.offset === "number"
        ? input.offset
        : undefined;

  const limit = clampLimit(numericLimit);
  if (numericLimit !== undefined && Number.isFinite(numericLimit)) {
    if (numericLimit < RESPONSE_PAGE_LIMITS.min) {
      return { action: "reject", message: RESPONSES_LIST_MESSAGES.limitTooSmall };
    }
    if (numericLimit > RESPONSE_PAGE_LIMITS.max) {
      return { action: "reject", message: RESPONSES_LIST_MESSAGES.limitTooLarge };
    }
  }

  return {
    action: "fetch",
    assignmentId,
    start,
    end,
    limit,
    offset: clampOffset(numericOffset),
  };
}
/** Shape of a single rating_event as returned by the RPC. */
export interface ResponseEvent {
  id: string;
  assignment_id: string;
  organization_id: string;
  rating: number;
  label: string | null;
  emoji: string | null;
  created_at: string;
  user_agent: string | null;
  followup: {
    session_id: string | null;
    current_rating: number | null;
    rating_label: string | null;
    rating_emoji: string | null;
    identity_status: string | null;
    follow_up_status: string | null;
    contact_status: string | null;
    contact_requested: boolean | null;
    follow_up_submitted_at: string | null;
    contact_requested_at: string | null;
    customer_name: string | null;
    customer_email: string | null;
    comment: string | null;
  } | null;
}

/** Shape of the envelope returned by the RPC. */
export interface ResponseListEnvelope {
  events: ResponseEvent[];
  total: number;
  channel: string | null;
  template: string | null;
  assignment: {
    id: string;
    organization_id: string;
    channel: string | null;
    employee_name: string | null;
    employee_id: string | null;
    location_name_en: string | null;
    location_name_ar: string | null;
  };
  limit: number;
  offset: number;
}

/**
 * Validates an arbitrary value that is *expected* to be a ResponseListEnvelope.
 * Anything that is not a recognised structured envelope collapses to a safe
 * empty shape so callers never have to handle the unknown case twice.
 */
export function normalizeResponseEnvelope(value: unknown): ResponseListEnvelope {
  const empty = (): ResponseListEnvelope => ({
    events: [],
    total: 0,
    channel: null,
    template: null,
    assignment: {
      id: "",
      organization_id: "",
      channel: null,
      employee_name: null,
      employee_id: null,
      location_name_en: null,
      location_name_ar: null,
    },
    limit: RESPONSE_PAGE_LIMITS.default,
    offset: 0,
  });

  if (!value || typeof value !== "object") return empty();
  const v = value as Record<string, unknown>;

  const events = Array.isArray(v.events) ? (v.events as ResponseEvent[]) : [];
  const assignment =
    v.assignment && typeof v.assignment === "object"
      ? (v.assignment as ResponseListEnvelope["assignment"])
      : empty().assignment;

  const limit =
    typeof v.limit === "number" && Number.isFinite(v.limit)
      ? Math.max(RESPONSE_PAGE_LIMITS.min, Math.min(v.limit, RESPONSE_PAGE_LIMITS.max))
      : RESPONSE_PAGE_LIMITS.default;
  const offset =
    typeof v.offset === "number" && Number.isFinite(v.offset)
      ? Math.max(0, Math.floor(v.offset))
      : 0;
  const total = typeof v.total === "number" && Number.isFinite(v.total) ? v.total : events.length;

  return {
    events,
    total,
    channel: typeof v.channel === "string" ? v.channel : null,
    template: typeof v.template === "string" ? v.template : null,
    assignment,
    limit,
    offset,
  };
}

/**
 * Maps a server RPC error / unexpected payload to a safe error message.
 * Any failure must not leak server internals to the user — the surface is
 * deliberately narrow.
 */
export function resolveResponseListError(reason: unknown): string {
  if (typeof reason === "string") {
    if (reason === "denied") return "You do not have permission to view these responses.";
    if (reason === "not_found") return "This assignment could not be found.";
    if (reason === "forbidden") return "This assignment does not belong to your organization.";
  }
  return "We could not load the responses. Please try again.";
}