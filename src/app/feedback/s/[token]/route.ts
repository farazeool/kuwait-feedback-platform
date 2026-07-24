import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[a-f0-9]{24,128}$/i.test(token) && !/^[a-zA-Z0-9-]{24,128}$/.test(token)) {
    return NextResponse.json({ error: "Invalid signature link" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAnonymousClient() as any;

  // Record the click and get the assignment context
  const { data: clickResult, error } = await supabase.rpc("record_signature_click", {
    p_public_token: token,
    p_referrer: request.headers.get("referer") ?? null,
  });

  if (error || !clickResult || !(clickResult as Record<string, unknown>).found) {
    return NextResponse.redirect(new URL("/feedback/invalid", request.nextUrl.origin), 302);
  }

  const result = clickResult as Record<string, unknown>;
  const surveyId = result.survey_id as string;
  const campaignId = result.campaign_id as string | null;
  const employeeId = result.employee_id as string | null;

  const ratingParam = request.nextUrl.searchParams.get("r");

  // Look up the survey public slug via raw query
  const { data: survey } = await supabase
    .from("surveys")
    .select("public_slug")
    .eq("id", surveyId)
    .single();

  const slug = survey?.public_slug as string | undefined;
  if (!slug) {
    return NextResponse.redirect(new URL("/feedback/invalid", request.nextUrl.origin), 302);
  }

  const feedbackPath = `/feedback/${slug}`;
  const qp = new URLSearchParams();
  qp.set("t", token);
  qp.set("ch", "email");
  if (campaignId) qp.set("c", campaignId);
  if (employeeId) qp.set("e", employeeId);
  if (ratingParam) qp.set("r", ratingParam);

  return NextResponse.redirect(new URL(`${feedbackPath}?${qp.toString()}`, request.nextUrl.origin), 302);
}
