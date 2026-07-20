"use server";

import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const values = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!values.success) redirect("/login?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: values.data.email, password: values.data.password });
  if (error) redirect("/login?error=invalid_credentials");
  redirect(values.data.next || "/dashboard");
}

export async function signUp(formData: FormData) {
  const values = signUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password"), next: formData.get("next") });
  if (!values.success) redirect("/signup?error=invalid_input");
  const supabase = await createSupabaseServerClient();
  const env = getServerEnv();
  const next = values.data.next || "/dashboard";
  const { data, error } = await supabase.auth.signUp({
    email: values.data.email,
    password: values.data.password,
    options: { emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) redirect(`/signup?error=unavailable&next=${encodeURIComponent(next)}`);
  if (data.session) redirect(next);
  redirect(`/login?verify=1&next=${encodeURIComponent(next)}`);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const values = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (values.success) {
    const supabase = await createSupabaseServerClient();
    const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
    await supabase.auth.resetPasswordForEmail(values.data.email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });
  }
  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  const values = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!values.success) redirect("/reset-password?error=invalid_password");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: values.data.password,
  });
  if (error) redirect("/reset-password?error=session_expired");
  redirect("/login?reset=1");
}
