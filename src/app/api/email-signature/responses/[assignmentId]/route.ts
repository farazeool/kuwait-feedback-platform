import { NextResponse, type NextRequest } from "next/server";

import { getAppAccessContext } from "@/lib/auth/context";
import { listAssignmentRatingEvents } from "@/features/distribution/responses.server";
import { resolveResponseListError } from "@/features/distribution/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const context = await getAppAccessContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!context.organization && context.profile.platformRole !== "platform_admin") {
    return NextResponse.json({ error: "Organization context required" }, { status: 403 });
  }

  const { assignmentId } = await params;
  const { searchParams } = request.nextUrl;
  const result = await listAssignmentRatingEvents({
    assignmentId,
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: resolveResponseListError(result.error) },
      { status: result.status },
    );
  }

  return NextResponse.json(result.envelope, {
    headers: {
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}