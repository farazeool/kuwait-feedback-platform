"use server";

import { redirect } from "next/navigation";

import { deliverInvitationEmail } from "@/features/invitations/email";
import { invitationSchema, memberUpdateSchema } from "@/features/team/schemas";
import { requireAppAccessContext } from "@/lib/auth/context";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function deliver(invitation: { invitation_id: string; invitation_token: string; expires_at: string }, email: string, locale: "en" | "ar", role: string, personalMessage?: string) {
  const context = await requireAppAccessContext();
  const env = getServerEnv();
  const supabase = await createSupabaseServerClient();
  try {
    const result = await deliverInvitationEmail(email, {
      locale,
      organizationName: locale === "ar" ? context.organization?.nameAr ?? "" : context.organization?.nameEn ?? "",
      role,
      expiresAt: invitation.expires_at,
      acceptanceUrl: `${env.NEXT_PUBLIC_APP_URL}/invite/${invitation.invitation_token}`,
      personalMessage,
      primaryColor: context.organization?.primaryColor,
    });
    await supabase.rpc("record_invitation_delivery", { p_invitation_id: invitation.invitation_id, p_status: result.status });
  } catch {
    await supabase.rpc("record_invitation_delivery", { p_invitation_id: invitation.invitation_id, p_status: "failed", p_error_code: "provider_error" });
    throw new Error("Invitation delivery failed");
  }
}

export async function createInvitation(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard/team?error=unavailable");
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"), role: formData.get("role"), locations: formData.getAll("locations"),
    locale: formData.get("locale"), personalMessage: formData.get("personalMessage"), expiresDays: formData.get("expiresDays"),
  });
  if (!parsed.success) redirect("/dashboard/team/invitations?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("prepare_organization_invitation_v2", {
    p_organization_id: context.organization.id, p_email: parsed.data.email, p_role: parsed.data.role,
    p_location_ids: parsed.data.locations, p_expires_in: `${parsed.data.expiresDays} days`,
    p_personal_message: parsed.data.personalMessage || undefined, p_locale: parsed.data.locale,
  });
  const invitation = data?.[0];
  if (error || !invitation) redirect("/dashboard/team/invitations?error=unavailable");
  try { await deliver(invitation, parsed.data.email, parsed.data.locale, parsed.data.role, parsed.data.personalMessage); }
  catch { redirect("/dashboard/team/invitations?error=delivery"); }
  redirect("/dashboard/team/invitations?created=1");
}

export async function resendInvitation(formData: FormData) {
  const id = String(formData.get("invitationId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/dashboard/team/invitations?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resend_organization_invitation", { p_invitation_id: id });
  const invitation = data?.[0];
  if (error || !invitation) redirect("/dashboard/team/invitations?error=unavailable");
  const locale = invitation.invited_locale === "ar" ? "ar" : "en";
  try {
    await deliver(
      invitation,
      invitation.invited_email,
      locale,
      invitation.invited_role,
      invitation.personal_message ?? undefined,
    );
  } catch { redirect("/dashboard/team/invitations?error=delivery"); }
  redirect("/dashboard/team/invitations?resent=1");
}

export async function revokeInvitation(formData: FormData) {
  const id = String(formData.get("invitationId") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_organization_invitation", { p_invitation_id: id });
  redirect(error ? "/dashboard/team/invitations?error=unavailable" : "/dashboard/team/invitations?revoked=1");
}

export async function updateMember(formData: FormData) {
  const parsed = memberUpdateSchema.safeParse({ membershipId: formData.get("membershipId"), role: formData.get("role"), locations: formData.getAll("locations"), status: formData.get("status") });
  if (!parsed.success) redirect("/dashboard/team?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_organization_member", { p_membership_id: parsed.data.membershipId, p_role: parsed.data.role, p_location_ids: parsed.data.locations, p_status: parsed.data.status });
  redirect(error ? `/dashboard/team/${parsed.data.membershipId}?error=denied` : `/dashboard/team/${parsed.data.membershipId}?updated=1`);
}

export async function removeMember(formData: FormData) {
  const id = String(formData.get("membershipId") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_organization_member", { p_membership_id: id });
  redirect(error ? `/dashboard/team/${id}?error=denied` : "/dashboard/team?removed=1");
}

export async function transferOwnership(formData: FormData) {
  const context = await requireAppAccessContext();
  const id = String(formData.get("membershipId") ?? "");
  if (!context.organization) redirect("/dashboard/team?error=denied");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transfer_organization_ownership", { p_organization_id: context.organization.id, p_target_membership_id: id });
  redirect(error ? `/dashboard/team/${id}?error=denied` : "/dashboard?ownership=transferred");
}

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/.test(token)) redirect("/invite/unavailable");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await supabase.rpc("accept_organization_invitation", { p_token: token });
  if (error) await supabase.rpc("record_invitation_acceptance_failure", { p_token: token, p_reason: "unavailable" });
  redirect(error ? `/invite/${token}?error=unavailable` : "/dashboard");
}
