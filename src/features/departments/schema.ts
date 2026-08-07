import { z } from "zod";

export const departmentFormSchema = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  nameEn: z.string().trim().min(1).max(160),
  nameAr: z.string().trim().max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["active", "archived"]).default("active"),
});
