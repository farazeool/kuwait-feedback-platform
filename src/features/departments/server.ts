import "server-only";

import { notFound } from "next/navigation";

import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listDepartments() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [], locations: [] };
  const [{ data: rows }, { data: locations }] = await Promise.all([
    supabase.from("departments").select("*").eq("organization_id", context.organization.id).order("name_en"),
    supabase.from("locations").select("id, name_en, name_ar").eq("organization_id", context.organization.id).eq("status", "active").order("name_en"),
  ]);
  return { context, rows: rows ?? [], locations: locations ?? [] };
}

export async function getDepartment(departmentId: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("departments").select("*").eq("id", departmentId).maybeSingle();
  if (!data) notFound();
  return { context, department: data };
}
