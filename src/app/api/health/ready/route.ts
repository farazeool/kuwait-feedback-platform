import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { createRequestId, logWarning } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getServerEnv();
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logWarning("health_readiness_unavailable", { requestId: createRequestId() });
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
