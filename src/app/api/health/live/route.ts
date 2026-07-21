import { NextResponse } from "next/server";
import { createRequestId, logEvent } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export function GET() {
  logEvent("health_liveness", { requestId: createRequestId() });
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
