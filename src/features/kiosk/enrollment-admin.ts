import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnrollmentAdmin = {
  userId: string;
  organizationId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

/** Authenticate at the HTTP boundary. The enrollment SQL rechecks authorization. */
export async function getEnrollmentAdmin(kioskDeviceId: string): Promise<EnrollmentAdmin | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: kiosk } = await supabase
    .from("kiosk_devices")
    .select("organization_id")
    .eq("id", kioskDeviceId)
    .maybeSingle();
  if (!kiosk) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.platform_role === "platform_admin") {
    return { userId: user.id, organizationId: kiosk.organization_id, supabase };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role, status")
    .eq("organization_id", kiosk.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.status !== "active" || !["organization_owner", "organization_admin", "owner", "admin"].includes(membership.role)) return null;
  return { userId: user.id, organizationId: kiosk.organization_id, supabase };
}
