"use server";

import { redirect } from "next/navigation";

import { accountPasswordSchema, profileSettingsSchema } from "./schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) redirect("/dashboard/account/profile?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_own_profile", {
    p_display_name: parsed.data.displayName,
    p_locale: parsed.data.locale,
  });
  redirect(error ? "/dashboard/account/profile?error=denied" : "/dashboard/account/profile?updated=1");
}

export async function changeAccountPassword(formData: FormData) {
  const parsed = accountPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) redirect("/dashboard/account/security?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  redirect(error ? "/dashboard/account/security?error=denied" : "/dashboard/account/security?updated=1");
}

export async function signOutOtherSessions() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  redirect(error ? "/dashboard/account/security?error=denied" : "/dashboard/account/security?sessions=revoked");
}

export async function deactivateAccount() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("deactivate_own_account");
  if (error) redirect("/dashboard/account/security?error=ownership");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?account=deactivated");
}
