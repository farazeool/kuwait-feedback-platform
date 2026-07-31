import { describe, expect, it } from "vitest";
import {
  isKioskStatus,
  kioskStatusList,
  KIOSK_STATUSES,
  type KioskStatus,
} from "./status";

describe("KioskStatus", () => {
  describe("KIOSK_STATUSES", () => {
    it("contains all expected statuses", () => {
      expect(KIOSK_STATUSES).toEqual([
        "active",
        "paused",
        "maintenance",
        "offline",
        "revoked",
        "archived",
      ]);
    });

    it("has exactly 6 statuses", () => {
      expect(KIOSK_STATUSES).toHaveLength(6);
    });
  });

  describe("isKioskStatus", () => {
    it("returns true for valid statuses", () => {
      expect(isKioskStatus("active")).toBe(true);
      expect(isKioskStatus("paused")).toBe(true);
      expect(isKioskStatus("maintenance")).toBe(true);
      expect(isKioskStatus("offline")).toBe(true);
      expect(isKioskStatus("revoked")).toBe(true);
      expect(isKioskStatus("archived")).toBe(true);
    });

    it("returns false for invalid statuses", () => {
      expect(isKioskStatus("invalid")).toBe(false);
      expect(isKioskStatus("ACTIVE")).toBe(false);
      expect(isKioskStatus("Active")).toBe(false);
      expect(isKioskStatus("")).toBe(false);
      expect(isKioskStatus(null)).toBe(false);
      expect(isKioskStatus(undefined)).toBe(false);
      expect(isKioskStatus(123)).toBe(false);
      expect(isKioskStatus({})).toBe(false);
      expect(isKioskStatus([])).toBe(false);
    });

    it("acts as a type guard", () => {
      const input: unknown = "active";
      if (isKioskStatus(input)) {
        // TypeScript should narrow the type
        const status: KioskStatus = input;
        expect(status).toBe("active");
      } else {
        expect.unreachable("Should have been a valid status");
      }
    });
  });

  describe("kioskStatusList", () => {
    it("returns comma-separated list of statuses", () => {
      expect(kioskStatusList()).toBe(
        "active, paused, maintenance, offline, revoked, archived"
      );
    });

    it("is useful for error messages", () => {
      const invalidStatus = "unknown";
      const error = `Invalid status. Expected one of: ${kioskStatusList()}`;
      expect(error).toContain("active");
      expect(error).toContain("archived");
    });
  });
});