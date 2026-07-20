import { createHmac } from "node:crypto";

export const MAX_SUBMISSION_BODY_BYTES = 64 * 1024;
export const MIN_SUBMISSION_COMPLETION_MS = 1500;
export const MAX_SUBMISSION_COMPLETION_MS = 24 * 60 * 60 * 1000;

export function isWithinSubmissionBodyLimit(body: string, declaredLength = 0) {
  return declaredLength <= MAX_SUBMISSION_BODY_BYTES
    && new TextEncoder().encode(body).byteLength <= MAX_SUBMISSION_BODY_BYTES;
}

export async function readSubmissionBody(
  body: ReadableStream<Uint8Array> | null,
  limit = MAX_SUBMISSION_BODY_BYTES,
) {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export function isRealisticCompletionTime(startedAt: number, now: number) {
  const elapsed = now - startedAt;
  return elapsed >= MIN_SUBMISSION_COMPLETION_MS
    && elapsed <= MAX_SUBMISSION_COMPLETION_MS;
}

export function isAllowedSubmissionOrigin(origin: string | null, appUrl: string) {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export function createSubmissionFingerprint(
  secret: string,
  parts: { forwardedFor: string; userAgent: string; acceptLanguage: string },
) {
  return createHmac("sha256", secret)
    .update(`${parts.forwardedFor}|${parts.userAgent}|${parts.acceptLanguage}`)
    .digest("hex");
}
