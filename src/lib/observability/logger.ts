import "server-only";

import { redactLogMetadata } from "./redaction";

export function logEvent(event: string, metadata: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, metadata: redactLogMetadata(metadata) }));
}

export function logError(event: string, metadata: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), event, metadata: redactLogMetadata(metadata) }));
}
