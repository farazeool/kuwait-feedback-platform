import { NextRequest } from "next/server";
import { getEnrollmentAdmin } from "@/features/kiosk/enrollment-admin";
import { getEnrollmentSessionDetails, issueEnrollmentSession, revokeEnrollmentSession } from "@/features/kiosk/enrollment-server";
import { buildSetupUrl, consumeEnrollmentRateLimit, enrollmentJson, isUuid, readSmallJson, requestFingerprint } from "@/features/kiosk/enrollment-http";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const authError = () => enrollmentJson({ error: "Unauthorized" }, 401);
async function adminFor(params: Ctx["params"]) {
  const { id } = await params;
  if (!isUuid(id)) return { id, admin: null };
  return { id, admin: await getEnrollmentAdmin(id) };
}
export async function issue(request: NextRequest, id: string, ttl: unknown, admin: NonNullable<Awaited<ReturnType<typeof getEnrollmentAdmin>>>) {
  if (ttl !== undefined && (!Number.isInteger(ttl) || typeof ttl !== "number")) return enrollmentJson({ error: "Invalid expiration window" }, 400);
  const rateLimitKey = `${admin.userId}:${admin.organizationId}:${id}`;
  if (!await consumeEnrollmentRateLimit("kiosk-admin-issue", requestFingerprint(request, rateLimitKey), 5, 300)) return enrollmentJson({ error: "Please retry shortly" }, 429);
  const result = await issueEnrollmentSession(admin.supabase, id, ttl as number | undefined);
  if (!result.ok) return enrollmentJson({ error: result.reason === "rate_limited" ? "Please retry shortly" : "Unable to create setup link" }, result.reason === "rate_limited" ? 429 : result.reason === "not_authorized" ? 403 : 400);
  return enrollmentJson({ setupUrl: buildSetupUrl(result.value.rawToken), expiresAt: result.value.expiresAt, sessionId: result.value.sessionId });
}
export async function GET(_: NextRequest, { params }: Ctx) {
  const { id, admin } = await adminFor(params); if (!admin) return authError();
  const result = await getEnrollmentSessionDetails(admin.supabase, id);
  if (!result.ok) return enrollmentJson({ error: "Unable to read enrollment state" }, result.reason === "not_authorized" ? 403 : 400);
  return enrollmentJson({ session: result.value });
}
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, admin } = await adminFor(params); if (!admin) return authError();
  const body = await readSmallJson(request); if (!body || typeof body !== "object") return enrollmentJson({ error: "Invalid request" }, 400);
  return issue(request, id, (body as { ttlMinutes?: unknown }).ttlMinutes, admin);
}
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, admin } = await adminFor(params); if (!admin) return authError();
  const body = await readSmallJson(request); if ((body as { confirm?: unknown } | null)?.confirm !== true) return enrollmentJson({ error: "Confirmation required" }, 400);
  const result = await revokeEnrollmentSession(admin.supabase, id);
  if (!result.ok) return enrollmentJson({ error: "Unable to revoke setup link" }, result.reason === "not_authorized" ? 403 : 400);
  return enrollmentJson({ outcome: result.value.outcome });
}