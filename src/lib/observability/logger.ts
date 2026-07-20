import "server-only";

import { redactLogMetadata } from "./redaction";

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
  const version = process.env.DEPLOYMENT_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  const payload = JSON.stringify({ timestamp: new Date().toISOString(), level, event, deploymentVersion: version, metadata: redactLogMetadata(metadata) });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function logEvent(event: string, metadata: Record<string, unknown> = {}) { emit("info", event, metadata); }
export function logError(event: string, metadata: Record<string, unknown> = {}) {
  emit("error", event, metadata);
}
export function logWarning(event: string, metadata: Record<string, unknown> = {}) { emit("warn", event, metadata); }
export function createRequestId() { return crypto.randomUUID(); }
