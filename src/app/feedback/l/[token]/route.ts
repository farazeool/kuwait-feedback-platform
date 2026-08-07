import { NextResponse, type NextRequest } from "next/server";
import { isValidDistributionToken } from "@/lib/distribution/token-validator";

/**
 * Legacy redirect endpoint for backward compatibility.
 *
 * Existing email signatures may contain /feedback/l/{token} links.
 * This route immediately redirects to /f/{token} without performing
 * click tracking (which is now handled in the canonical /f route).
 *
 * For new signatures, the renderer generates /f/{token} links directly.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidDistributionToken(token)) {
    return NextResponse.json({ error: "Invalid distribution link" }, { status: 400 });
  }

  // Preserve rating query parameter for pre-selected ratings
  const ratingParam = request.nextUrl.searchParams.get("r");
  const directPath = `/f/${token}`;
  const qp = new URLSearchParams();
  if (ratingParam) qp.set("r", ratingParam);

  return NextResponse.redirect(
    new URL(`${directPath}${qp.toString() ? `?${qp.toString()}` : ""}`, request.nextUrl.origin),
    302
  );
}
