import { z } from "zod";

export const GOVERNORATES = [
  "capital",
  "hawalli",
  "farwaniya",
  "mubarak_al_kabeer",
  "ahmadi",
  "jahra",
] as const;

export const BUSINESS_CATEGORIES = [
  "restaurant",
  "retail",
  "hospitality",
  "healthcare",
  "professional_services",
  "other",
] as const;

const optionalTrimmed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);

export const onboardingSchema = z.object({
  organizationNameEn: z.string().trim().min(1).max(160),
  organizationNameAr: optionalTrimmed,
  organizationSlug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  businessCategory: z.enum(BUSINESS_CATEGORIES),
  phone: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().regex(/^\+965[0-9]{8}$/).optional(),
  ),
  locationNameEn: z.string().trim().min(1).max(160),
  locationNameAr: optionalTrimmed,
  governorate: z.enum(GOVERNORATES),
  area: z.string().trim().min(1).max(120),
  address: optionalTrimmed,
});

export function slugifyLocation(value: string) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return slug || "first-location";
}
