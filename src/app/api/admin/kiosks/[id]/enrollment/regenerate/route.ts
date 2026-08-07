import { NextRequest } from "next/server";
import { getEnrollmentAdmin } from "@/features/kiosk/enrollment-admin";
import { enrollmentJson, isUuid, readSmallJson } from "@/features/kiosk/enrollment-http";
import { issue } from "../route";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return enrollmentJson({ error: "Invalid device ID" }, 400);

  const admin = await getEnrollmentAdmin(id);
  if (!admin) return enrollmentJson({ error: "Unauthorized" }, 401);

  const body = await readSmallJson(request);
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== true) {
    return enrollmentJson({ error: "Confirmation required" }, 400);
  }

  return issue(request, id, (body as { ttlMinutes?: unknown }).ttlMinutes, admin);
}
