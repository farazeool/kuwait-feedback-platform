import { NextRequest } from "next/server";
import { markEnrollmentSessionOpened } from "@/features/kiosk/enrollment-server";
import { consumeEnrollmentRateLimit, enrollmentJson, readSmallJson, requestFingerprint } from "@/features/kiosk/enrollment-http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const body = await readSmallJson(request);
  const token = typeof (body as { token?: unknown } | null)?.token === "string" ? (body as { token: string }).token : "";
  if (!token || token.length > 512) return enrollmentJson({ status: "accepted" }, 202);
  if (await consumeEnrollmentRateLimit("kiosk-opened", requestFingerprint(request, token), 30, 300)) await markEnrollmentSessionOpened(token);
  return enrollmentJson({ status: "accepted" }, 202);
}