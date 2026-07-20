"use server";

import { redirect } from "next/navigation";

import {
  onboardingSchema,
  slugifyLocation,
} from "@/features/onboarding/schema";
import { requireOnboardingUser } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createOrganization(formData: FormData) {
  await requireOnboardingUser();
  const values = onboardingSchema.safeParse({
    organizationNameEn: formData.get("organizationNameEn"),
    organizationNameAr: formData.get("organizationNameAr"),
    organizationSlug: formData.get("organizationSlug"),
    businessCategory: formData.get("businessCategory"),
    phone: formData.get("phone"),
    locationNameEn: formData.get("locationNameEn"),
    locationNameAr: formData.get("locationNameAr"),
    governorate: formData.get("governorate"),
    area: formData.get("area"),
    address: formData.get("address"),
  });
  if (!values.success) redirect("/onboarding?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization_with_first_location", {
    p_name_en: values.data.organizationNameEn,
    p_name_ar: values.data.organizationNameAr ?? "",
    p_slug: values.data.organizationSlug,
    p_business_category: values.data.businessCategory,
    p_phone: values.data.phone ?? "",
    p_location_name_en: values.data.locationNameEn,
    p_location_name_ar: values.data.locationNameAr ?? "",
    p_location_slug: slugifyLocation(values.data.locationNameEn),
    p_governorate: values.data.governorate,
    p_area: values.data.area,
    p_address: values.data.address ?? "",
    p_timezone: "Asia/Kuwait",
  });

  if (error?.code === "23505") redirect("/onboarding?error=duplicate_slug");
  if (error) redirect("/onboarding?error=onboarding_failed");
  redirect("/dashboard");
}
