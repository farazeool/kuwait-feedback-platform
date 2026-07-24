import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listCampaigns() {
  const context = await requireAppAccessContext();
  if (!context.organization) return { context, campaigns: [] };

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("campaigns")
    .select("id, name_en, name_ar, survey_id, channel, status, starts_at, ends_at, created_at")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  return { context, campaigns: data ?? [] };
}

export async function getCampaign(campaignId: string) {
  const context = await requireAppAccessContext();
  if (!context.organization) return null;

  const supabase = await createSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("campaigns")
    .select("id, name_en, name_ar, survey_id, channel, status, starts_at, ends_at, created_at")
    .eq("id", campaignId)
    .eq("organization_id", context.organization.id)
    .single();

  return data ?? null;
}
