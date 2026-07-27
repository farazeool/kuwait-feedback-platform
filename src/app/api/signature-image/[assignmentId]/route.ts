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
  // When our bundled Inter font is absent, omit `fonts` entirely so @vercel/og
  // falls back to its built-in default font. Passing an empty array disables all
  // fonts and throws "No fonts are loaded".
  const fonts = fontEntry ? [{ name: "Inter", data: fontEntry, weight: 400 as const }] : undefined;

  const pngResponse = async (element: ReturnType<typeof buildPlaceholderBadge>, cacheSeconds = 300) => {
    const img = new ImageResponse(element, { width: W, height: H, fonts });
    const buf = await img.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  };

  if (!TOKEN_RE.test(token)) {
    return pngResponse(buildPlaceholderBadge(W, H), 60);
  }

  const supabase = sb(createSupabaseAnonymousClient());
  // anon has no SELECT on distribution_assignments (by design). Resolve the
  // badge via a read-only SECURITY DEFINER RPC that returns only {active, render_config}.
  const { data: badge } = await supabase.rpc("get_signature_badge", {
    p_public_token: token,
  });

  const isInactive = !badge || badge.active !== true;
  const renderConfig = (badge?.render_config ?? {}) as Record<string, unknown>;

  const element = isInactive
    ? buildPlaceholderBadge(W, H)
    : buildSignatureBadge({ config: renderConfig, width: W, height: H });

  return pngResponse(element, isInactive ? 60 : 300);
}
