import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Count the kiosk devices belonging to an organization.
 *
 * This backs the cosmetic "N devices" badge on the feedback channels index, so
 * it never throws: a missing organization (a platform admin with no membership)
 * or a failing RPC both resolve to 0 rather than taking down the whole page.
 * The kiosks page itself surfaces load errors, which is where an operator would
 * go to act on them.
 */
export async function countKioskDevices(
  organizationId: string | null
): Promise<number> {
  if (!organizationId) return 0;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_kiosk_devices", {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error("Failed to count kiosk devices:", error);
    return 0;
  }

  return Array.isArray(data) ? data.length : 0;
}
