import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/kiosk/eligible-surveys?organizationId=...&kioskId=...
 *
 * Returns the surveys that an administrator is allowed to assign to a
 * given kiosk. The RPC enforces both organization membership and
 * kiosk-organization match; we still require an authenticated session
 * server-side, and we still resolve the caller's identity through the
 * cookie-based Supabase client so the RPC sees a real auth.uid().
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const kioskId = url.searchParams.get("kioskId");

  if (!organizationId || !kioskId) {
    return NextResponse.json(
      { error: "organizationId and kioskId are required" },
      { status: 400 },
    );
  }

  // Lightweight UUID shape check; the RPC will do the strict check.
  if (
    !/^[0-9a-fA-F-]{36}$/.test(organizationId) ||
    !/^[0-9a-fA-F-]{36}$/.test(kioskId)
  ) {
    return NextResponse.json(
      { error: "organizationId and kioskId must be UUIDs" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc(
    "list_eligible_surveys_for_kiosk",
    {
      p_organization_id: organizationId,
      p_kiosk_device_id: kioskId,
    },
  );

  if (error) {
    const message = error.message ?? "Failed to load eligible surveys";
    const lower = message.toLowerCase();
    const status = lower.includes("not authorized")
      ? 403
      : lower.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const surveys = Array.isArray(data) ? data : [];
  return NextResponse.json({ surveys });
}