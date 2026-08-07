import "server-only";

import { logError } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  decideListResponses,
  normalizeResponseEnvelope,
  type ListResponsesDecision,
  type ResponseListEnvelope,
} from "./responses";

/**
 * Server-only wrapper around the `list_assignment_rating_events` RPC.
 *
 * Returns a normalized envelope on success, or `{ error, status }` describing
 * a *server-side* failure (auth, missing row, RPC failure). The route handler
 * is responsible for mapping those to the correct HTTP status code.
 */
export async function listAssignmentRatingEvents(input: {
  assignmentId: string;
  start?: string | null;
  end?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
}): Promise<
  | { ok: true; envelope: ResponseListEnvelope; decision: ListResponsesDecision & { action: "fetch" } }
  | { ok: false; status: number; error: string }
> {
  const decision = decideListResponses(input);
  if (decision.action === "reject") {
    return { ok: false, status: 400, error: decision.message };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_assignment_rating_events", {
    p_assignment_id: decision.assignmentId,
    p_start_at: decision.start ?? undefined,
    p_end_at: decision.end ?? undefined,
    p_limit: decision.limit,
    p_offset: decision.offset,
  });

  if (error) {
    // PostgreSQL RAISE EXCEPTION uses errcode `42501` for insufficient
    // privilege (RLS denial) — surface that as 403 rather than a generic 503.
    const code = (error as { code?: string }).code;
    if (code === "42501") {
      return { ok: false, status: 403, error: "forbidden" };
    }
    if (code === "P0001") {
      return { ok: false, status: 403, error: "denied" };
    }
    logError("[distribution] listAssignmentRatingEvents RPC failed", { code, message: error.message });
    return { ok: false, status: 503, error: "rpc_failed" };
  }

  // The RPC may legitimately return an empty envelope when the assignment does
  // not exist or the caller has no read access — collapse both to 404 so the
  // client cannot distinguish "missing" from "forbidden" (defense in depth).
  const envelope = normalizeResponseEnvelope(data);
  if (!envelope.assignment.id) {
    return { ok: false, status: 404, error: "not_found" };
  }

  return { ok: true, envelope, decision };
}