import "server-only";

import { notFound } from "next/navigation";

import { invitationsResultSchema, publicInvitationSchema, teamFilterSchema, teamResultSchema } from "./schemas";
import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listTeam(raw: Record<string, string | undefined>) {
  const context = await requireAppAccessContext();
  if (!context.organization) notFound();
  const filters = teamFilterSchema.parse(raw);
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: locations }] = await Promise.all([
    supabase.rpc("list_team_members", { p_organization_id: context.organization.id, p_search: filters.q, p_role: filters.role, p_location_id: filters.location, p_page: filters.page, p_page_size: 20 }),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", context.organization.id).order("name_en"),
  ]);
  if (error) throw new Error("Team unavailable");
  return { context, filters, locations: locations ?? [], ...teamResultSchema.parse(data) };
}

export async function listInvitations() {
  const context = await requireAppAccessContext();
  if (!context.organization) notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: locations }] = await Promise.all([
    supabase.rpc("list_team_invitations", { p_organization_id: context.organization.id }),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", context.organization.id).eq("status", "active").order("name_en"),
  ]);
  if (error) throw new Error("Invitations unavailable");
  return { context, locations: locations ?? [], invitations: invitationsResultSchema.parse(data) };
}

export async function getMember(memberId: string) {
  const result = await listTeam({ page: "1", q: memberId });
  const member = result.members.find((item) => item.id === memberId);
  if (!member) notFound();
  return { ...result, member };
}

export async function getPublicInvitation(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return publicInvitationSchema.parse({ state: "unavailable" });
  const supabase = createSupabaseAnonymousClient();
  const { data } = await supabase.rpc("get_invitation_public", { p_token: token });
  const parsed = publicInvitationSchema.safeParse(data);
  if (!parsed.success) return publicInvitationSchema.parse({ state: "unavailable" });
  const logoPath = parsed.data.organization?.logo_path;
  const { data: signed } = logoPath
    ? await supabase.storage.from("organization-branding").createSignedUrl(logoPath, 3600)
    : { data: null };
  return parsed.data.organization
    ? { ...parsed.data, organization: { ...parsed.data.organization, logo_url: signed?.signedUrl ?? null } }
    : parsed.data;
}
