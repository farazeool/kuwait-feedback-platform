import "server-only";

import { notFound } from "next/navigation";

import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvestigationStatus, EscalationDecision } from "./schema";

export interface InvestigationRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  branch_id: string;
  department_id: string | null;
  product_id: string | null;
  product_category_id: string | null;
  product_name: string | null;
  investigated_at: string;
  investigator_id: string;
  created_by: string;
  evidence_reviewed: string | null;
  repeated_complaints: boolean;
  repeated_complaints_notes: string | null;
  temperature_records: unknown;
  receiving_records: unknown;
  inspection_records: unknown;
  supplier_information: unknown;
  root_cause: string | null;
  findings: string | null;
  recommendation: string | null;
  escalation_decision: EscalationDecision;
  status: InvestigationStatus;
  controlled_record_references: string[];
  timeline: unknown;
  internal_notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  branch: { id: string; name_en: string; name_ar: string } | null;
  department: { id: string; name_en: string; name_ar: string } | null;
  investigator: { display_name: string; email: string } | null;
  created_by_profile: { display_name: string; email: string } | null;
}

export interface CommentEntry {
  id: string;
  investigation_id: string;
  comment: string;
  event_type: string;
  author_id: string;
  created_at: string;
  author: { display_name: string; email: string } | null;
}

export interface StatusHistoryEntry {
  id: string;
  investigation_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  change_reason: string | null;
  changed_by_profile: { display_name: string; email: string } | null;
}

export interface AttachmentEntry {
  id: string;
  investigation_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  description: string | null;
  evidence_category: string | null;
  uploaded_by: string;
  uploaded_at: string;
  uploaded_by_profile: { display_name: string; email: string } | null;
}

export interface RelatedResponse {
  id: string;
  survey_id: string;
  location_id: string;
  overall_rating: number | null;
  workflow_status: string;
  submitted_at: string;
  channel: string;
  survey: { title_en: string; title_ar: string } | null;
  location: { name_en: string; name_ar: string } | null;
}

export interface RelatedAlert {
  id: string;
  alert_type: string;
  status: string;
  rating_value: number | null;
  threshold_value: number | null;
  message: string | null;
  created_at: string;
}

export interface RelatedCorrectiveAction {
  id: string;
  problem: string;
  status: string;
  priority: string;
  created_at: string;
}

export async function listInvestigations(filters: {
  q?: string;
  status?: string;
  branchId?: string;
  departmentId?: string;
  investigatorId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [] as InvestigationRow[], pageCount: 0, totalCount: 0 };

  const orgId = context.organization.id;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  let query = supabase
    .from("investigations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("*, branch:locations!branch_id(id, name_en, name_ar), department:departments!department_id(id, name_en, name_ar)", { count: "exact" } as any)
    .eq("organization_id", orgId)
    .order("investigated_at", { ascending: false });

  if (filters.q?.trim()) {
    query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%,findings.ilike.%${filters.q}%`);
  }
  if (filters.status) query = query.eq("status", filters.status as InvestigationStatus);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.investigatorId) query = query.eq("investigator_id", filters.investigatorId);

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error("Failed to load investigations");

  return {
    context,
    rows: (data ?? []) as unknown as InvestigationRow[],
    pageCount: Math.ceil((count ?? 0) / pageSize),
    totalCount: count ?? 0,
  };
}

export async function getInvestigation(investigationId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) notFound();

  const { data: investigation, error } = await supabase
    .from("investigations")
    .select("*, branch:locations!branch_id(id, name_en, name_ar), department:departments!department_id(id, name_en, name_ar)")
    .eq("id", investigationId)
    .maybeSingle();

  if (error || !investigation) notFound();

  // Verify organization access
  if (investigation.organization_id !== context.organization.id) notFound();

  // Fetch comments
  const { data: comments } = await supabase
    .from("investigation_comments")
    .select("*, author:profiles!author_id(display_name, email)")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: true });

  // Fetch status history
  const { data: statusHistory } = await supabase
    .from("investigation_status_history")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("changed_at", { ascending: false });

  // Fetch attachments
  const { data: attachments } = await supabase
    .from("investigation_attachments")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("uploaded_at", { ascending: false });

  // Fetch investigator and creator display names
  const { data: investigatorProfile } = investigation.investigator_id
    ? await supabase.from("profiles").select("display_name, email").eq("id", investigation.investigator_id).maybeSingle()
    : { data: null };
  const { data: creatorProfile } = investigation.created_by
    ? await supabase.from("profiles").select("display_name, email").eq("id", investigation.created_by).maybeSingle()
    : { data: null };

  // Fetch related responses via junction table
  let relatedResponses: RelatedResponse[] = [];
  const { data: responseLinks } = await supabase
    .from("investigation_responses")
    .select("response_id")
    .eq("investigation_id", investigationId);

  const responseIds = (responseLinks ?? []).map((r) => r.response_id).filter(Boolean);
  if (responseIds.length > 0) {
     
const { data: responses } = await supabase
      .from("survey_responses")
      .select("id, survey_id, location_id, overall_rating, workflow_status, submitted_at, locale, channel, location:locations!location_id(name_en, name_ar)")
      .in("id", responseIds);
    relatedResponses = (responses ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        survey_id: row.survey_id as string,
        location_id: row.location_id as string,
        overall_rating: row.overall_rating as number | null,
        workflow_status: row.workflow_status as string,
        submitted_at: row.submitted_at as string,
        channel: row.channel as string,
        survey: null as { title_en: string; title_ar: string } | null,
        location: (row.location as { name_en: string; name_ar: string } | null),
      };
    });
  }

  // Fetch related alerts via junction table
  let relatedAlerts: RelatedAlert[] = [];
  const { data: alertLinks } = await supabase
    .from("investigation_alerts")
    .select("alert_id")
    .eq("investigation_id", investigationId);

  const alertIds = (alertLinks ?? []).map((a) => a.alert_id).filter(Boolean);
  if (alertIds.length > 0) {
    const { data: alerts } = await supabase
      .from("alerts")
      .select("id, alert_type, status, rating_value, threshold_value, message, created_at")
      .in("id", alertIds);
    relatedAlerts = (alerts ?? []) as RelatedAlert[];
  }

  // Fetch related corrective actions via junction table
  let relatedCorrectiveActions: RelatedCorrectiveAction[] = [];
  const { data: caLinks } = await supabase
    .from("investigation_corrective_actions")
    .select("corrective_action_id")
    .eq("investigation_id", investigationId);

  const caIds = (caLinks ?? []).map((c) => c.corrective_action_id).filter(Boolean);
  if (caIds.length > 0) {
    const { data: actions } = await supabase
      .from("corrective_actions")
      .select("id, problem, status, priority, created_at")
      .in("id", caIds);
    relatedCorrectiveActions = (actions ?? []) as RelatedCorrectiveAction[];
  }

  const enrichedInvestigation = {
    ...investigation,
    branch: (investigation as Record<string, unknown>).branch ?? null,
    department: (investigation as Record<string, unknown>).department ?? null,
    investigator: investigatorProfile,
    created_by_profile: creatorProfile,
  } as unknown as InvestigationRow;

  return {
    context,
    investigation: enrichedInvestigation,
    comments: (comments ?? []) as unknown as CommentEntry[],
    statusHistory: (statusHistory ?? []) as unknown as StatusHistoryEntry[],
    attachments: (attachments ?? []) as unknown as AttachmentEntry[],
    relatedResponses,
    relatedAlerts,
    relatedCorrectiveActions,
  };
}

export async function getInvestigationFilterOptions() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");

  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { branches: [], departments: [], investigators: [] as { id: string; display_name: string }[] };

  const orgId = context.organization.id;

  const [{ data: branches }, { data: departments }, { data: memberships }] = await Promise.all([
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", orgId).eq("status", "active").order("name_en"),
    supabase.from("departments").select("id, name_en, name_ar").eq("organization_id", orgId).order("name_en"),
    supabase.from("organization_memberships").select("user_id").eq("organization_id", orgId).eq("status", "active"),
  ]);

  const memberIds = (memberships ?? []).map((m) => m.user_id).filter(Boolean);
  const { data: investigators } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds).order("display_name")
    : { data: [] };

  return {
    branches: branches ?? [],
    departments: departments ?? [],
    investigators: investigators ?? [],
  };
}
