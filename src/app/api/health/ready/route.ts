import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getServerEnv();
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
