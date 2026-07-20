import "server-only";
import { notFound } from "next/navigation";
import { requireAppAccessContext, requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOrganizationSettings() {
  const context = await requireOrganizationManagementContext();
  if (!context.organization) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("organizations").select("*").eq("id", context.organization.id).single();
  if (!data) notFound();
  return { context, organization: data };
}

export async function getLocationSettings(locationId?: string) {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  if (!locationId) return { context, location: null };
  const { data } = await supabase.from("locations").select("*").eq("id", locationId).maybeSingle();
  if (!data) notFound();
  return { context, location: data };
}
