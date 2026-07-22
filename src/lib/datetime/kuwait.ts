export const KUWAIT_TIME_ZONE = "Asia/Kuwait" as const;

export function formatKuwaitDate(
  value: Date | string,
  locale: "en" | "ar" = "en",
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW" : "en-KW", {
    dateStyle: "medium",
    timeZone: KUWAIT_TIME_ZONE,
  }).format(date);
}

export function formatKuwaitDateTime(
  value: Date | string,
  locale: "en" | "ar" = "en",
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-KW" : "en-KW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: KUWAIT_TIME_ZONE,
  }).format(date);
}
