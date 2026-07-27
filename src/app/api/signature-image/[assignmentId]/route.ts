import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "@vercel/og";

import { buildSignatureBadge, buildPlaceholderBadge } from "@/features/distribution/renderers/badge";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

export const runtime = "nodejs";

const TOKEN_RE = /^(?:[a-f0-9]{24,128}|[a-zA-Z0-9-]{24,128})$/;

let fontData: ArrayBuffer | null | false = null;
function getFont(): ArrayBuffer | null {
  if (fontData === null) {
    try {
      fontData = readFileSync(join(process.cwd(), "public", "fonts", "Inter-Regular.ttf")).buffer;
    } catch {
      fontData = false;
    }
  }
  return fontData || null;
}

const W = 480;
const H = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = (s: any) => s;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId: token } = await params;

  const fontEntry = getFont();
  const fonts = fontEntry ? [{ name: "Inter", data: fontEntry, weight: 400 as const }] : [];

  const placeholderResponse = () =>
    new ImageResponse(buildPlaceholderBadge(W, H), { width: W, height: H, fonts });

  if (!TOKEN_RE.test(token)) {
    return new NextResponse(placeholderResponse().body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const supabase = sb(createSupabaseAnonymousClient());
  const { data: assignment } = await supabase
    .from("distribution_assignments")
    .select("status, expires_at, template:distribution_templates!template_id(render_config)")
    .eq("public_token", token)
    .single();

  const isInactive =
    !assignment ||
    assignment.status === "revoked" ||
    assignment.status === "expired" ||
    (assignment.expires_at && new Date(assignment.expires_at) < new Date());

  const renderConfig = (assignment?.template?.render_config ?? {}) as Record<string, unknown>;

  const element = isInactive
    ? buildPlaceholderBadge(W, H)
    : buildSignatureBadge({ config: renderConfig, width: W, height: H });

  const img = new ImageResponse(element, { width: W, height: H, fonts });

  return new NextResponse(img.body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
