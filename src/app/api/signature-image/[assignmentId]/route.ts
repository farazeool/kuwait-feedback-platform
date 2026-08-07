import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "@vercel/og";

import { buildSignatureBadge, buildPlaceholderBadge } from "@/features/distribution/renderers/badge";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";

export const runtime = "nodejs";

// Note: `@vercel/og` 1.0.0 does not declare `ImageResponse extends Response` in
// its published types, even though its runtime does (the constructor returns
// `new Response(stream, { headers, status, statusText })`). The fix is a
// module augmentation in the co-located `image-response.d.ts` that re-declares
// `ImageResponse` as `extends Response`, so `.arrayBuffer()` type-checks and the
// route's return is assignable to `Response` for Next's typed route handler
// signature.

const TOKEN_RE = /^(?:[a-f0-9]{24,128}|[a-zA-Z0-9-]{24,128})$/;

/**
 * Shape of the `get_signature_badge` RPC result. The RPC is declared as
 * returning `Json` in the generated `database.ts` types, so we narrow the
 * value at the consumer site with a runtime type guard (no unsafe cast).
 * Anything that doesn't have the expected keys is treated as "missing" and
 * served the placeholder, which matches the previous `sb((s: any) => s)`
 * runtime behavior of falling through to the inactive branch.
 */
type SignatureBadge = {
  active: boolean;
  render_config: Record<string, unknown>;
};

function isSignatureBadge(value: unknown): value is SignatureBadge {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.active === "boolean" &&
    typeof v.render_config === "object" &&
    v.render_config !== null
  );
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId: rawParam } = await params;
  // Email snippets reference the badge as `/api/signature-image/{token}.png` so
  // the URL looks like a static image to clients and caches. Strip a trailing
  // `.png` before validating — the token itself never contains a dot.
  const token = rawParam.replace(/\.png$/i, "");

  const fontEntry = getFont();
  // When our bundled Inter font is absent, omit `fonts` entirely so @vercel/og
  // falls back to its built-in default font. Passing an empty array disables all
  // fonts and throws "No fonts are loaded".
  const fonts = fontEntry ? [{ name: "Inter", data: fontEntry, weight: 400 as const }] : undefined;

  const pngResponse = async (element: ReturnType<typeof buildPlaceholderBadge>, cacheSeconds = 300) => {
    const img = new ImageResponse(element, { width: W, height: H, fonts });
    // `ImageResponse` IS a `Response` at runtime (see `image-response.d.ts`),
    // so `.arrayBuffer()` returns the PNG bytes. We re-wrap with our own
    // headers via `NextResponse` (which is assignable to `Response`).
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

  const supabase = createSupabaseAnonymousClient();
  // anon has no SELECT on distribution_assignments (by design). Resolve the
  // badge via a read-only SECURITY DEFINER RPC that returns only {active, render_config}.
  const { data: rawBadge } = await supabase.rpc("get_signature_badge", {
    p_public_token: token,
  });

  const badge: SignatureBadge | null = isSignatureBadge(rawBadge) ? rawBadge : null;
  const isInactive = badge === null || badge.active !== true;
  const renderConfig = badge?.render_config ?? {};

  const element = isInactive
    ? buildPlaceholderBadge(W, H)
    : buildSignatureBadge({ config: renderConfig, width: W, height: H });

  return pngResponse(element, isInactive ? 60 : 300);
}
