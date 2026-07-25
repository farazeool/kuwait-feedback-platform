import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[a-f0-9]{24,128}$/i.test(token) && !/^[a-zA-Z0-9-]{24,128}$/.test(token)) {
    return NextResponse.json({ error: "Invalid distribution link" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAnonymousClient() as any;

  // Record the click via the generic RPC
  const { data: clickResult, error } = await supabase.rpc("record_distribution_click", {
    p_public_token: token,
    p_ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    p_user_agent: request.headers.get("user-agent") ?? null,
    p_referer: request.headers.get("referer") ?? null,
  });

  if (error || !clickResult || !(clickResult as Record<string, unknown>).found) {
    return NextResponse.redirect(new URL("/feedback/invalid", request.nextUrl.origin), 302);
  }

  const result = clickResult as Record<string, unknown>;
  const surveyId = result.survey_id as string;
  const campaignId = result.campaign_id as string | null;
  const touchpointId = result.touchpoint_id as string | null;
  const channel = result.channel as string | null;

  // Rating from query param (for pre-selected ratings)
  const ratingParam = request.nextUrl.searchParams.get("r");

  // Look up the survey public slug
  const { data: survey } = await supabase
    .from("surveys")
    .select("public_slug")
    .eq("id", surveyId)
    .single();

  const slug = survey?.public_slug as string | undefined;
  if (!slug) {
    return NextResponse.redirect(new URL("/feedback/invalid", request.nextUrl.origin), 302);
  }

  // Build redirect URL with attribution
  // d = distribution public token, t = touchpoint token (align with feedback page's searchParams)
  const feedbackPath = `/feedback/${slug}`;
  const qp = new URLSearchParams();
  qp.set("d", token);
  if (channel) qp.set("ch", channel);
  if (campaignId) qp.set("c", campaignId);
  if (touchpointId) qp.set("t", touchpointId);
  if (ratingParam) qp.set("r", ratingParam);

  return NextResponse.redirect(new URL(`${feedbackPath}?${qp.toString()}`, request.nextUrl.origin), 302);
}
