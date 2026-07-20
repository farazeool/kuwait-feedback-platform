"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const alertActionSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(["open", "acknowledged", "resolved", "dismissed"]),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).default(""),
  resolutionNote: z.string().trim().max(1000).default(""),
});

export async function updateAlertWorkflow(formData: FormData) {
  await requireAppAccessContext();
  const parsed = alertActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/alerts?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_alert_workflow", {
    p_alert_id: parsed.data.alertId,
    p_status: parsed.data.status,
    p_assigned_to: parsed.data.assignedTo || undefined,
    p_resolution_note: parsed.data.resolutionNote || undefined,
  });
  if (error) redirect(`/dashboard/alerts/${parsed.data.alertId}?error=denied`);
  redirect(`/dashboard/alerts/${parsed.data.alertId}?updated=1`);
}
