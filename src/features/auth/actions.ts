"use server";

import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/features/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const values = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!values.success) redirect("/login?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(values.data);
  if (error) redirect("/login?error=invalid_credentials");
  redirect("/dashboard");
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
