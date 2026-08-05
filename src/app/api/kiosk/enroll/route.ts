import { NextRequest } from "next/server";
import { exchangeEnrollmentToken } from "@/features/kiosk/enrollment-server";
import { consumeEnrollmentRateLimit, enrollmentJson, readSmallJson, requestFingerprint } from "@/features/kiosk/enrollment-http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readSmallJson(request);
  const token = typeof (body as { token?: unknown } | null)?.token === "string" ? (body as { token: string }).token : "";
  if (!token || token.length > 512) return enrollmentJson({ error: "invalid_link" }, 400);
  const allowed = await consumeEnrollmentRateLimit("kiosk-enroll", requestFingerprint(request, token), 20, 300);
  if (!allowed) {
    const response = enrollmentJson({ error: "invalid_link" }, 429);
    response.headers.set("Retry-After", "300");
    return response;
  }
  const exchanged = await exchangeEnrollmentToken(token);
  if (!exchanged.ok) return enrollmentJson({ error: "invalid_link" }, 400);

  const response = enrollmentJson({ status: "enrolled", redirectTo: "/kiosk/device" });
  response.cookies.set("kiosk_credential", exchanged.value.rawDeviceCredential, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/kiosk", maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}