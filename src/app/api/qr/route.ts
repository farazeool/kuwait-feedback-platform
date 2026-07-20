import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";

import { isAllowedFeedbackUrl } from "@/features/distribution/qr";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("value") ?? "";
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const download = request.nextUrl.searchParams.get("download") === "1";
  const env = getServerEnv();
  if (value.length > 500 || !isAllowedFeedbackUrl(value, env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({ error: "Invalid QR target" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let publicSlug: string;
  try {
    publicSlug = decodeURIComponent(new URL(value).pathname.slice("/feedback/".length));
  } catch {
    return NextResponse.json({ error: "Invalid QR target" }, { status: 400 });
  }
  const { data: survey } = await supabase
    .from("surveys")
    .select("id")
    .eq("public_slug", publicSlug)
    .maybeSingle();
  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  if (format === "png") {
    const data = await QRCode.toBuffer(value, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        ...(download ? { "Content-Disposition": "attachment; filename=feedback-qr.png" } : {}),
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const svg = await QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      ...(download ? { "Content-Disposition": "attachment; filename=feedback-qr.svg" } : {}),
      "Cache-Control": "private, max-age=300",
    },
  });
}
