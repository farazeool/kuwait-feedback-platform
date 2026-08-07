import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Typed shape of the `get_signature_sentiment_report` RPC result.
 *
 * Mirrors the JSON built in `supabase/migrations/20260806120000_feedback_followup_workflow.sql`.
 * Only the fields we actually surface in the email-signature UI are typed; the
 * rest are forwarded as `unknown` to avoid drift if the RPC grows new keys.
 */
export interface SignatureSentimentReport {
  total_responses: number;
  average_rating: number | null;
  rating_counts: {
    bad: number;
    poor: number;
    average: number;
    good: number;
    excellent: number;
  };
  identity_counts: {
    anonymous: number;
    self_reported: number;
  };
  comment_rate: number | null;
  contact_requested_count: number;
  unresolved_contact_requests: number;
  follow_up_completion_rate: number | null;
  by_location: Array<{
    location_id: string | null;
    location_name_en: string | null;
    location_name_ar: string | null;
    count: number;
  }>;
  by_employee: Array<{
    employee_id: string | null;
    employee_name: string | null;
    count: number;
  }>;
  by_channel: Array<{ channel: string; count: number }>;
}

/** Safe defaults when the RPC returns nothing — keeps the UI from crashing. */
const EMPTY_REPORT: SignatureSentimentReport = {
  total_responses: 0,
  average_rating: null,
  rating_counts: { bad: 0, poor: 0, average: 0, good: 0, excellent: 0 },
  identity_counts: { anonymous: 0, self_reported: 0 },
  comment_rate: null,
  contact_requested_count: 0,
  unresolved_contact_requests: 0,
  follow_up_completion_rate: null,
  by_location: [],
  by_employee: [],
  by_channel: [],
};

/**
 * Calls `get_signature_sentiment_report` for the email channel, scoped to the
 * calling org and the supplied date window.
 *
 * Returns a normalized envelope so callers can render without null-checking
 * every nested field.
 */
export async function getEmailSignatureSentimentReport(params: {
  organizationId: string;
  startAt: string;
  endAt: string;
}): Promise<SignatureSentimentReport> {
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("get_signature_sentiment_report", {
    p_organization_id: params.organizationId,
    p_start_at: params.startAt,
    p_end_at: params.endAt,
    p_employee_id: null,
    p_location_id: null,
    p_sentiment: null,
    p_identity_status: null,
    p_contact_requested: null,
    p_follow_up_completed: null,
  });
  if (error || !data || typeof data !== "object") return EMPTY_REPORT;
  // Defensive merge: preserve any field the RPC returns that we don't model
  // (forward-compatibility) but make sure every typed key has a safe value.
  return { ...EMPTY_REPORT, ...(data as Partial<SignatureSentimentReport>) };
}