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

  // NOTE: `assigned_employee_id` is a FK to `auth.users`, not `public.profiles`,
  // so PostgREST cannot embed `profiles` directly off `distribution_assignments`
  // (it returns PGRST200). Employee display names are resolved via a separate
  // `organization_memberships` + `profiles` lookup below and mapped back by
  // `assigned_employee_id === user_id`. Only genuine FK relationships are
  // embedded here: the location target and the template. The template FK is
  // composite `(template_id, organization_id)`, so it must be disambiguated by
  // its constraint name (`da_template_org_fkey`) rather than a column hint.
  let q = supabase
    .from("distribution_assignments")
    .select("*, location:locations!assigned_location_id(name_en, name_ar), template:distribution_templates!da_template_org_fkey(template_name, channel)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (templateId) q = q.eq("template_id", templateId);

  // `organization_memberships` also has no FK to `profiles` (its `user_id`
  // points at `auth.users`), so fetch memberships and profile display names as
  // two plain, org-scoped queries and join them in application code.
  const [assignmentsRes, membersRes, locationsRes] = await Promise.all([
    q,
    supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    supabase
      .from("locations")
      .select("id, name_en, name_ar")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name_en"),
  ]);

  const assignments = (assignmentsRes.data ?? []) as DistributionAssignment[];

  // Collect the org's active member user_ids, plus any employee ids referenced
  // by assignments (an assignment may point at a user whose membership was
  // since deactivated — we still want to label the assignment where possible).
  const memberUserIds = (membersRes.data ?? [])
    .map((m: Record<string, unknown>) => m.user_id as string)
    .filter(Boolean);
  const assignedIds = assignments
    .map((a) => a.assigned_employee_id)
    .filter((id): id is string => Boolean(id));
  const profileIds = Array.from(new Set([...memberUserIds, ...assignedIds]));

  // Resolve display names in a single org-agnostic `profiles` query (profiles
  // are keyed by auth user id). RLS still governs visibility.
  const profilesRes = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] as Array<{ id: string; display_name: string | null }> };

  const displayNameByUserId = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as Array<{ id: string; display_name: string | null }>) {
    if (p.display_name) displayNameByUserId.set(p.id, p.display_name);
  }

  // Attach an `employee` object to each employee-targeted assignment, matching
  // on `assigned_employee_id === user_id`. Assignments are preserved even when
  // no membership/profile display name is available (safe fallback label), and
  // location/touchpoint/generic-subject assignments are left untouched.
  const assignmentsWithEmployee = assignments.map((a) =>
    a.assigned_employee_id
      ? {
          ...a,
          employee: {
            display_name:
              displayNameByUserId.get(a.assigned_employee_id) ?? "Unknown employee",
          },
        }
      : a,
  ) as DistributionAssignment[];

  return {
    context: ctx,
    assignments: assignmentsWithEmployee,
    employees: memberUserIds.map((userId: string) => ({
      id: userId,
      displayName: displayNameByUserId.get(userId) ?? "Unknown employee",
    })),
    locations: locationsRes.data ?? [],
  };
}
