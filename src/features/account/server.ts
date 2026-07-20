import "server-only";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAccountSettings() {
  const context = await requireAppAccessContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: memberships }, { data: authData }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, role, status, created_at, organizations(name_en, name_ar, slug)")
      .eq("user_id", context.user.id)
      .order("created_at"),
    supabase.auth.getUser(),
  ]);
  return { context, memberships: memberships ?? [], user: authData.user };
}
