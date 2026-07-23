import "server-only";

import { notFound } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CorrectiveActionStatus, CorrectiveActionPriority } from "./schema";

export interface CorrectiveActionRow {
  id: string;
  organization_id: string;
  problem: string;
  root_cause: string;
  action_description: string;
  priority: CorrectiveActionPriority;
  status: CorrectiveActionStatus;
  branch_id: string | null;
  department_id: string | null;
  source_response_id: string | null;
  related_alert_id: string | null;
  controlled_record_reference: string | null;
  due_date: string;
  target_completion_date: string;
  completion_date: string | null;
  closure_date: string | null;
  assigned_owner_id: string;
  created_by: string;
  verified_by: string | null;
  verified_at: string | null;
  verification_status: string | null;
  verification_comments: string | null;
  effectiveness_result: string | null;
  effectiveness_review_date: string | null;
  effectiveness_review_notes: string | null;
  closure_approval: string | null;
  closure_approved_by: string | null;
  closure_approved_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  branch: { id: string; name_en: string; name_ar: string } | null;
  department: { id: string; name_en: string; name_ar: string } | null;
  assigned_owner: { display_name: string; email: string } | null;
  created_by_profile: { display_name: string; email: string } | null;
  verified_by_profile: { display_name: string; email: string } | null;
  closure_approved_by_profile: { display_name: string; email: string } | null;
}

export interface Attachment {
  id: string;
  corrective_action_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
  verification_status: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_comments: string | null;
  uploaded_by_profile: { display_name: string; email: string } | null;
}

export interface StatusHistoryEntry {
  id: string;
  corrective_action_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  change_reason: string | null;
  changed_by_profile: { display_name: string; email: string } | null;
}

export interface CommentEntry {
  id: string;
  corrective_action_id: string;
  comment: string;
  author_id: string;
  created_at: string;
  author: { display_name: string; email: string } | null;
}

export async function listCorrectiveActions(filters: {
  q?: string;
  status?: string;
  priority?: string;
  branchId?: string;
  departmentId?: string;
  assignedOwnerId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [] as CorrectiveActionRow[], pageCount: 0, totalCount: 0 };

  const orgId = context.organization.id;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  let query = supabase
    .from("corrective_actions")
     
    .select("*, branch:locations!branch_id(id, name_en, name_ar), department:departments!department_id(id, name_en, name_ar)", { count: "exact" } as any)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters.q?.trim()) {
    query = query.or(`problem.ilike.%${filters.q}%,root_cause.ilike.%${filters.q}%,action_description.ilike.%${filters.q}%`);
  }
  if (filters.status) query = query.eq("status", filters.status as CorrectiveActionStatus);
  if (filters.priority) query = query.eq("priority", filters.priority as CorrectiveActionPriority);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.assignedOwnerId) query = query.eq("assigned_owner_id", filters.assignedOwnerId);
  if (filters.dueDateFrom) query = query.gte("due_date", filters.dueDateFrom);
  if (filters.dueDateTo) query = query.lte("due_date", filters.dueDateTo);

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error("Failed to load corrective actions");

  return {
    context,
    rows: (data ?? []) as unknown as CorrectiveActionRow[],
    pageCount: Math.ceil((count ?? 0) / pageSize),
    totalCount: count ?? 0,
  };
}

export async function getCorrectiveAction(actionId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) notFound();

  const { data: action, error } = await supabase
    .from("corrective_actions")
    .select("*, branch:locations!branch_id(id, name_en, name_ar), department:departments!department_id(id, name_en, name_ar)")
    .eq("id", actionId)
    .maybeSingle();

  if (error || !action) notFound();

  // Verify organization access
  if (action.organization_id !== context.organization.id) notFound();

  // Fetch attachments
  const { data: attachments } = await supabase
    .from("corrective_action_attachments")
    .select("*")
    .eq("corrective_action_id", actionId)
    .order("uploaded_at", { ascending: false });

  // Fetch status history
  const { data: statusHistory } = await supabase
    .from("corrective_action_status_history")
    .select("*")
    .eq("corrective_action_id", actionId)
    .order("changed_at", { ascending: false });

  // Fetch comments
  const { data: comments } = await supabase
    .from("corrective_action_comments")
    .select("*, author:profiles!author_id(display_name, email)")
    .eq("corrective_action_id", actionId)
    .order("created_at", { ascending: true });

  // Fetch assignee display name
  const { data: assignee } = action.assigned_owner_id
    ? await supabase.from("profiles").select("display_name, email").eq("id", action.assigned_owner_id).maybeSingle()
    : { data: null };
  const { data: creator } = action.created_by
    ? await supabase.from("profiles").select("display_name, email").eq("id", action.created_by).maybeSingle()
    : { data: null };
  const { data: verifier } = action.verified_by
    ? await supabase.from("profiles").select("display_name, email").eq("id", action.verified_by).maybeSingle()
    : { data: null };

  // Fetch related source response if exists
  let sourceResponse = null;
  if (action.source_response_id) {
     
    const { data } = await (supabase
      .from("survey_responses")
      .select("id, overall_rating, workflow_status, submitted_at, locale, channel, survey:surveys!survey_id(title_en, title_ar), location:locations!location_id(name_en, name_ar)")
      .eq("id", action.source_response_id)
      .maybeSingle()) as any;
    sourceResponse = data;
  }

  // Fetch related alert if exists
  let relatedAlert = null;
  if (action.related_alert_id) {
    const { data } = await supabase
      .from("alerts")
      .select("id, alert_type, status, rating_value, threshold_value, message, created_at")
      .eq("id", action.related_alert_id)
      .maybeSingle();
    relatedAlert = data;
  }

  const enrichedAction = {
    ...action,
    branch: (action as any).branch ?? null,
    department: (action as any).department ?? null,
    assigned_owner: assignee,
    created_by_profile: creator,
    verified_by_profile: verifier,
    closure_approved_by_profile: null,
  } as unknown as CorrectiveActionRow;

  return {
    context,
    action: enrichedAction,
    attachments: (attachments ?? []) as unknown as Attachment[],
    statusHistory: (statusHistory ?? []) as unknown as StatusHistoryEntry[],
    comments: (comments ?? []) as unknown as CommentEntry[],
    sourceResponse,
    relatedAlert,
  };
}

export async function getFilterOptions() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { branches: [], departments: [], assignees: [] as { id: string; display_name: string }[] };

  const orgId = context.organization.id;

  const [{ data: branches }, { data: departments }, { data: memberships }] = await Promise.all([
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", orgId).eq("status", "active").order("name_en"),
    supabase.from("departments").select("id, name_en, name_ar").eq("organization_id", orgId).order("name_en"),
    supabase.from("organization_memberships").select("user_id").eq("organization_id", orgId).eq("status", "active"),
  ]);

  const assigneeIds = (memberships ?? []).map((m) => m.user_id).filter(Boolean);
  const { data: assignees } = assigneeIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", assigneeIds).order("display_name")
    : { data: [] };

  return {
    branches: branches ?? [],
    departments: departments ?? [],
    assignees: assignees ?? [],
  };
}