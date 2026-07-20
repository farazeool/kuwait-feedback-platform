import { z } from "zod";

const roleSchema = z.enum(["organization_admin", "location_manager", "analyst"]);
const locationIds = z.array(z.string().uuid()).max(50);

export const invitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: roleSchema,
  locations: locationIds,
  locale: z.enum(["en", "ar"]),
  personalMessage: z.string().trim().max(500).optional(),
  expiresDays: z.coerce.number().int().min(1).max(30),
}).superRefine((value, context) => {
  if (value.role === "location_manager" && value.locations.length === 0) context.addIssue({ code: "custom", path: ["locations"], message: "Location assignment required" });
  if (value.role === "organization_admin" && value.locations.length > 0) context.addIssue({ code: "custom", path: ["locations"], message: "Organization administrators cannot be location scoped" });
});

export const memberUpdateSchema = z.object({
  membershipId: z.string().uuid(),
  role: roleSchema,
  locations: locationIds,
  status: z.enum(["active", "archived"]),
});

export const teamFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: roleSchema.optional(),
  location: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export const publicInvitationSchema = z.object({
  state: z.enum(["valid", "expired", "revoked", "used", "unavailable"]),
  role: z.string().optional(),
  expires_at: z.string().optional(),
  email_hint: z.string().optional(),
  personal_message: z.string().nullable().optional(),
  locale: z.enum(["en", "ar"]).optional(),
  organization: z.object({
    name_en: z.string(), name_ar: z.string(), primary_color: z.string(), accent_color: z.string(), logo_path: z.string().nullable(), logo_url: z.string().url().nullable().optional(),
  }).optional(),
});

export const teamResultSchema = z.object({
  total: z.number(), page: z.number(), page_size: z.number(),
  members: z.array(z.object({
    id: z.string().uuid(), user_id: z.string().uuid(), display_name: z.string(), email: z.string(),
    role: z.string(), scope: z.string(), status: z.string(), created_at: z.string(),
    preferred_locale: z.string(), last_sign_in_at: z.string().nullable(),
    locations: z.array(z.object({ id: z.string().uuid(), name_en: z.string(), name_ar: z.string() })),
  })),
});

export const invitationsResultSchema = z.array(z.object({
  id: z.string().uuid(), email: z.string(), role: z.string(), scope: z.string(), locale: z.string(),
  personal_message: z.string().nullable(), expires_at: z.string(), accepted_at: z.string().nullable(),
  revoked_at: z.string().nullable(), delivery_status: z.string(), delivery_attempts: z.number(),
  last_delivery_at: z.string().nullable(), created_at: z.string(),
  locations: z.array(z.object({ id: z.string().uuid(), name_en: z.string(), name_ar: z.string() })),
}));
