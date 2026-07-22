"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ratingScaleFormSchema } from "./schema";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveRatingScale(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = ratingScaleFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/rating-scales?error=invalid");
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const payload = {
    name_en: v.nameEn,
    name_ar: v.nameAr,
    scale_min: v.scaleMin,
    scale_max: v.scaleMax,
    satisfied_min: v.satisfiedMin,
    negative_max: v.negativeMax,
    is_active: v.isActive === "true",
  };
  const existing = await getExistingScale(v.key, supabase);
  if (existing) {
    const { error } = await supabase.from("rating_scales").update(payload).eq("key", v.key);
    if (error) redirect(`/dashboard/settings/rating-scales/${v.key}?error=denied`);
    await syncScalePoints(v.key, v.points, supabase);
    redirect(`/dashboard/settings/rating-scales/${v.key}?updated=1`);
  }
  const { data, error } = await supabase.from("rating_scales").insert({ ...payload, key: v.key }).select("key").single();
  if (error || !data) redirect("/dashboard/settings/rating-scales?error=denied");
  await syncScalePoints(v.key, v.points, supabase);
  redirect(`/dashboard/settings/rating-scales/${v.key}?created=1`);
}

async function getExistingScale(key: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase.from("rating_scales").select("key").eq("key", key).maybeSingle();
  return data ?? null;
}

async function syncScalePoints(scaleKey: string, points: Array<{ value: number; labelEn: string; labelAr: string }>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  await supabase.from("rating_scale_points").delete().eq("scale_key", scaleKey);
  const rows = points.map((point) => ({
    scale_key: scaleKey,
    value: point.value,
    label_en: point.labelEn,
    label_ar: point.labelAr,
    position: point.value,
  }));
  if (rows.length) await supabase.from("rating_scale_points").insert(rows);
}

export async function deleteRatingScale(formData: FormData) {
  const context = await requireOrganizationManagementContext();
  const parsed = z.object({ key: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/rating-scales?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("rating_scales").delete().eq("key", parsed.data.key);
  redirect(error ? "/dashboard/settings/rating-scales?error=denied" : "/dashboard/settings/rating-scales?deleted=1");
}
