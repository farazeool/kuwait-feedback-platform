import { z } from "zod";

const optionalEmail = z.union([z.literal(""), z.string().trim().toLowerCase().email().max(320)]);
const optionalPhone = z.union([z.literal(""), z.string().regex(/^\+[1-9][0-9]{7,14}$/)]);

export const organizationSettingsSchema = z.object({
  nameEn: z.string().trim().min(1).max(160), nameAr: z.string().trim().max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  businessCategory: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  phone: optionalPhone, email: optionalEmail,
  website: z.union([z.literal(""), z.string().url().startsWith("https://").max(500)]),
  descriptionEn: z.string().trim().max(2000), descriptionAr: z.string().trim().max(2000),
  defaultLocale: z.enum(["en", "ar"]), dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd"]),
  numberFormat: z.enum(["en-KW", "ar-KW"]), supportEmail: optionalEmail, supportPhone: optionalPhone,
});

export const brandingSettingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  headerStyle: z.enum(["standard", "compact", "centered"]),
  thankYouEn: z.string().trim().max(500), thankYouAr: z.string().trim().max(500),
  footerEn: z.string().trim().max(500), footerAr: z.string().trim().max(500),
});

export const locationSettingsSchema = z.object({
  locationId: z.string().uuid().optional(), organizationId: z.string().uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().trim().min(1).max(160), nameAr: z.string().trim().max(160),
  governorate: z.enum(["capital", "hawalli", "farwaniya", "mubarak_al_kabeer", "ahmadi", "jahra"]),
  area: z.string().trim().min(1).max(120), addressEn: z.string().trim().max(500), addressAr: z.string().trim().max(500),
  phone: optionalPhone, email: optionalEmail, openingHours: z.string().trim().max(5000),
  inheritsTimezone: z.boolean(), timezone: z.literal("Asia/Kuwait"), status: z.enum(["active", "archived"]),
}).transform((value) => {
  let openingHours: Record<string, unknown> = {};
  if (value.openingHours) {
    const parsed: unknown = JSON.parse(value.openingHours);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Opening hours must be an object");
    openingHours = parsed as Record<string, unknown>;
  }
  return { ...value, openingHours };
});

export function detectBrandImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}
