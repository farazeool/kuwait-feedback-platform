import { z } from "zod";

export const touchpointFormSchema = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  surveyId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  channel: z.enum(["qr", "kiosk", "web"]),
  status: z.enum(["active", "archived"]).default("active"),
});
