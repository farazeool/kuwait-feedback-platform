export const CSV_BOM = "\uFEFF";

export function protectSpreadsheetCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const protectedText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

export function csvLine(values: unknown[]) {
  return `${values.map(protectSpreadsheetCell).join(",")}\r\n`;
}

export function safeExportFilename(kind: string, date: string) {
  const safeKind = kind.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "export";
  return `kuwait-feedback-${safeKind}-${date}.csv`;
}
