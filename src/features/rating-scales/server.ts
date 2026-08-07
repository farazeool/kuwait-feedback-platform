import "server-only";

import { notFound } from "next/navigation";

import { getAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listRatingScales() {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  if (!context.organization) return { context, rows: [] };
  const { data: rows } = await supabase.from("rating_scales").select("*").order("name_en");
  return { context, rows: rows ?? [] };
}

export async function getRatingScale(key: string) {
  const context = await getAppAccessContext();
  if (!context) throw new Error("Authentication required");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("rating_scales").select("*").eq("key", key).maybeSingle();
  if (!data) notFound();
  const { data: points } = await supabase.from("rating_scale_points").select("*").eq("scale_key", key).order("position");
  return { context, scale: data, points: points ?? [] };
}
