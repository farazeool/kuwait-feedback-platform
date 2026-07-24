"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAppAccessContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const controlledRecordTypeEnum = z.enum(["investigation", "ncr", "capa"]).nullable().optional();

const responseWorkflowSchema = z.object({
  responseId: z.string().uuid(),
  status: z.enum(["monitor_only", "branch_followup", "controlled_investigation", "immediate_escalation"]),
  assignedTo: z.union([z.string().uuid(), z.literal("")]).default(""),
  tags: z.string().max(1000).default(""),
  note: z.string().trim().max(2000).default(""),
  controlledRecordType: controlledRecordTypeEnum,
  controlledRecordReference: z.string().trim().max(200).default(""),
  controlledRecordReason: z.string().trim().max(2000).default(""),
  followUpDetails: z.string().trim().max(2000).default(""),
  outcomeSummary: z.string().trim().max(5000).optional().default(""),
});

export async function updateResponseWorkflow(formData: FormData) {
  await requireAppAccessContext();
  const raw = Object.fromEntries(formData);
  const parsed = responseWorkflowSchema.safeParse(raw);
  if (!parsed.success) redirect("/dashboard/responses?error=invalid");
  const tags = parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const supabase = await createSupabaseServerClient();

  // Server-side validation for controlled record requirements
  if (parsed.data.status === "controlled_investigation" || parsed.data.status === "immediate_escalation") {
    if (!parsed.data.controlledRecordType || !parsed.data.controlledRecordReference || !parsed.data.controlledRecordReason) {
      redirect(`/dashboard/responses/${parsed.data.responseId}?error=validation`);
    }
  }
  if (parsed.data.status === "branch_followup" && !parsed.data.followUpDetails) {
    redirect(`/dashboard/responses/${parsed.data.responseId}?error=validation`);
  }

  const { error } = await supabase.rpc("update_response_workflow", {
    p_response_id: parsed.data.responseId,
    p_status: parsed.data.status,
    p_assigned_to: parsed.data.assignedTo || undefined,
    p_tags: tags,
    p_note: parsed.data.note || undefined,
    p_controlled_record_type: parsed.data.controlledRecordType || undefined,
    p_controlled_record_reference: parsed.data.controlledRecordReference || undefined,
    p_controlled_record_reason: parsed.data.controlledRecordReason || undefined,
    p_follow_up_details: parsed.data.followUpDetails || undefined,
    p_outcome_summary: parsed.data.outcomeSummary || undefined,
  });
  if (error) redirect(`/dashboard/responses/${parsed.data.responseId}?error=denied`);
  redirect(`/dashboard/responses/${parsed.data.responseId}?updated=1`);
}
