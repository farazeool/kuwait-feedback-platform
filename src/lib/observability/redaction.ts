const SENSITIVE_KEY = /(?:secret|password|token|cookie|authorization|api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|invite|answer|text[_-]?value|internal[_-]?note|raw[_-]?ip|forwarded[_-]?for|fingerprint)/i;
const REDACTED = "[REDACTED]";

export function redactLogMetadata(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactLogMetadata(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactLogMetadata(entryValue, entryKey)]));
  }
  return value;
}

export { REDACTED };
