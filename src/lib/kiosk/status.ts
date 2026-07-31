import type { Database } from "@/types/database";

/**
 * Kiosk lifecycle status, sourced from the generated `kiosk_status` Postgres
 * enum so this list cannot drift from the database definition.
 */
export type KioskStatus = Database["public"]["Enums"]["kiosk_status"];

export const KIOSK_STATUSES: readonly KioskStatus[] = [
  "active",
  "paused",
  "maintenance",
  "offline",
  "revoked",
  "archived",
];

/**
 * Narrows untrusted input (query strings, JSON bodies) to a valid kiosk status.
 * Callers should reject invalid values rather than forwarding them to the
 * database, where they would fail as an invalid enum literal.
 */
export function isKioskStatus(value: unknown): value is KioskStatus {
  return (
    typeof value === "string" &&
    (KIOSK_STATUSES as readonly string[]).includes(value)
  );
}

/** Human-readable list for use in validation error messages. */
export function kioskStatusList(): string {
  return KIOSK_STATUSES.join(", ");
}
