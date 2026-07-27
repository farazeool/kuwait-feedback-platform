import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SubjectRatingReport {
  subjects: Array<{
    subject_type: string;
    subject_id: string;
    label: string;
    template_id: string;
    count: number;
    avg_rating: number | null;
    distribution: Record<string, number>;
    trend: Array<{ date: string; avg: number; count: number }>;
  }>;
  totals: { count: number; avg_rating: number | null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export async function getSignatureSubjectReport(params: {
  organizationId: string;
  startAt: string;
  endAt: string;
  subjectType?: string;
  templateId?: string;
  locationId?: string;
}): Promise<SubjectRatingReport> {
  const supabase = sb(await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("get_signature_subject_report", {
    p_organization_id: params.organizationId,
    p_start_at: params.startAt,
    p_end_at: params.endAt,
    p_subject_type: params.subjectType ?? null,
    p_template_id: params.templateId ?? null,
    p_location_id: params.locationId ?? null,
  });
  if (error) throw error;
  return (data ?? { subjects: [], totals: {} }) as SubjectRatingReport;
}
