"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const responseWorkflowSchema = z.object({
  responseId: z.string().uuid(),
  status: z.enum(["unread", "reviewed", "action_required", "resolved"]),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).default(""),
  tags: z.string().max(1000).default(""),
  note: z.string().trim().max(2000).default(""),
});

export async function updateResponseWorkflow(formData: FormData) {
  await requireAppAccessContext();
  const parsed = responseWorkflowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/responses?error=invalid");
  const tags = parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_response_workflow", {
    p_response_id: parsed.data.responseId,
    p_status: parsed.data.status,
    p_assigned_to: parsed.data.assignedTo || undefined,
    p_tags: tags,
    p_note: parsed.data.note || undefined,
  });
  if (error) redirect(`/dashboard/responses/${parsed.data.responseId}?error=denied`);
  redirect(`/dashboard/responses/${parsed.data.responseId}?updated=1`);
}
