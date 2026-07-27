import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export interface DistributionTemplate {
  id: string;
  organization_id: string;
  channel: string;
  template_name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  config: Record<string, unknown>;
  render_config: Record<string, unknown>;
  created_at: string;
}

export interface DistributionAssignment {
  id: string;
  organization_id: string;
  template_id: string;
  survey_id: string | null;
  campaign_id: string | null;
  assigned_employee_id: string | null;
  assigned_location_id: string | null;
  assigned_touchpoint_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  revoked_at: string | null;
  public_token: string;
  status: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  click_count: number;
  response_count: number;
  last_clicked_at: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function resolveSubjectLabel(
  assignment: Pick<DistributionAssignment, "subject_type" | "subject_id" | "metadata"> & {
    employee?: { display_name?: string } | null;
    location?: { name_en?: string } | null;
    touchpoint?: { name_en?: string } | null;
  },
): string {
  const metaLabel = (assignment.metadata as Record<string, unknown>)?.label;
  if (typeof metaLabel === "string" && metaLabel) return metaLabel;
  if (assignment.employee?.display_name) return assignment.employee.display_name;
  if (assignment.location?.name_en) return assignment.location.name_en;
  if (assignment.touchpoint?.name_en) return assignment.touchpoint.name_en;
  if (assignment.subject_type && assignment.subject_id) {
    return `${assignment.subject_type}: ${assignment.subject_id}`;
  }
  return "Unknown";
}

export async function listTemplates(channel?: string) {
  const ctx = await requireAppAccessContext();
  if (!ctx.organization) return { context: ctx, templates: [] as DistributionTemplate[], surveys: [] };
  const supabase = sb(await createSupabaseServerClient());
  const orgId = ctx.organization.id;

  let q = supabase
    .from("distribution_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (channel) q = q.eq("channel", channel);

  const [{ data: templates }, { data: surveys }] = await Promise.all([
    q,
    supabase
      .from("surveys")
      .select("id, title_en, title_ar")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("title_en"),
  ]);

  return {
    context: ctx,
    templates: (templates ?? []) as DistributionTemplate[],
    surveys: surveys ?? [],
  };
}

export async function getTemplate(templateId: string) {
  const ctx = await requireAppAccessContext();
  if (!ctx.organization) return null;
  const supabase = sb(await createSupabaseServerClient());
  const { data } = await supabase
    .from("distribution_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", ctx.organization.id)
    .single();
  return data as DistributionTemplate | null;
}

export async function listAssignments(templateId?: string) {
  const ctx = await requireAppAccessContext();
  if (!ctx.organization) return { context: ctx, assignments: [] as DistributionAssignment[], employees: [], locations: [] };
  const supabase = sb(await createSupabaseServerClient());
  const orgId = ctx.organization.id;

  let q = supabase
    .from("distribution_assignments")
    .select("*, employee:profiles!assigned_employee_id(display_name), location:locations!assigned_location_id(name_en, name_ar), template:distribution_templates!template_id(template_name, channel)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (templateId) q = q.eq("template_id", templateId);

  const [assignmentsRes, employeesRes, locationsRes] = await Promise.all([
    q,
    supabase
      .from("organization_memberships")
      .select("user_id, profile:profiles!user_id(display_name, id)")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    supabase
      .from("locations")
      .select("id, name_en, name_ar")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name_en"),
  ]);

  return {
    context: ctx,
    assignments: (assignmentsRes.data ?? []) as DistributionAssignment[],
    employees: (employeesRes.data ?? []).map((e: Record<string, unknown>) => ({
      id: (e.profile as Record<string, unknown>)?.id ?? e.user_id,
      displayName: (e.profile as Record<string, unknown>)?.display_name ?? "Unknown",
    })),
    locations: locationsRes.data ?? [],
  };
}
