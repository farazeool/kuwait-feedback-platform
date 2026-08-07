import "server-only";

import { notFound } from "next/navigation";

import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listTouchpoints() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [], locations: [], departments: [], surveys: [] };
  const [{ data: rows }, { data: locations }, { data: departments }, { data: surveys }] = await Promise.all([
    supabase.from("touchpoints").select("*").eq("organization_id", context.organization.id).order("name_en"),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", context.organization.id).eq("status", "active").order("name_en"),
    supabase.from("departments").select("id, name_en, name_ar").eq("organization_id", context.organization.id).order("name_en"),
    supabase.from("surveys").select("id, title_en, title_ar").eq("organization_id", context.organization.id).order("title_en"),
  ]);
  const locationById = new Map((locations ?? []).map((loc) => [loc.id, loc]));
  const departmentById = new Map((departments ?? []).map((dept) => [dept.id, dept]));
  const enrichedRows = (rows ?? []).map((row) => ({
    ...row,
    locations: locationById.get(row.location_id) ?? null,
    departments: departmentById.get(row.department_id) ?? null,
  }));
  return { context, rows: enrichedRows, locations: locations ?? [], departments: departments ?? [], surveys: surveys ?? [] };
}

export async function getTouchpoint(touchpointId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("touchpoints").select("*").eq("id", touchpointId).maybeSingle();
  if (!data) notFound();
  return { context, touchpoint: data };
}
