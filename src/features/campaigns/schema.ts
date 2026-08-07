import { z } from "zod";

export const campaignSchema = z.object({
  surveyId: z.string().uuid(),
  nameEn: z.string().min(1).max(200),
  nameAr: z.string().max(200).default(""),
  channel: z.enum(["email", "qr", "kiosk", "web", "walk_in", "phone", "whatsapp", "tablet", "sms"]).default("email"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
