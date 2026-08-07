"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ratingScaleFormSchema } from "./schema";
import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveRatingScale(formData: FormData) {
  await requireOrganizationManagementContext();
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
    try {
      await syncScalePoints(v.key, v.points, supabase);
    } catch {
      redirect(`/dashboard/settings/rating-scales/${v.key}?error=points`);
    }
    redirect(`/dashboard/settings/rating-scales/${v.key}?updated=1`);
  }
  const { data, error } = await supabase.from("rating_scales").insert({ ...payload, key: v.key }).select("key").single();
  if (error || !data) redirect("/dashboard/settings/rating-scales?error=denied");
  try {
    await syncScalePoints(v.key, v.points, supabase);
  } catch {
    redirect("/dashboard/settings/rating-scales?error=points");
  }
  redirect(`/dashboard/settings/rating-scales/${v.key}?created=1`);
}

async function getExistingScale(key: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase.from("rating_scales").select("key").eq("key", key).maybeSingle();
  return data ?? null;
}

async function syncScalePoints(scaleKey: string, points: Array<{ value: number; labelEn: string; labelAr: string }>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  // Delete old points first, then insert new ones in a transactional manner
  const { error: deleteError } = await supabase.from("rating_scale_points").delete().eq("scale_key", scaleKey);
  if (deleteError) throw new Error("Failed to clear existing scale points");
  if (!points.length) return;
  const rows = points.map((point) => ({
    scale_key: scaleKey,
    value: point.value,
    label_en: point.labelEn,
    label_ar: point.labelAr,
    position: point.value,
  }));
  const { error: insertError } = await supabase.from("rating_scale_points").insert(rows);
  if (insertError) throw new Error("Failed to persist rating scale points");
}

export async function deleteRatingScale(formData: FormData) {
  await requireOrganizationManagementContext();
  const parsed = z.object({ key: z.string() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/settings/rating-scales?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("rating_scales").delete().eq("key", parsed.data.key);
  redirect(error ? "/dashboard/settings/rating-scales?error=denied" : "/dashboard/settings/rating-scales?deleted=1");
}
