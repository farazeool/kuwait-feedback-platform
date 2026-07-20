import "server-only";

import nodemailer from "nodemailer";

import { renderInvitationEmail, type InvitationTemplateInput } from "./email-template";
import { getServerEnv } from "@/lib/env/server";

export async function deliverInvitationEmail(to: string, input: InvitationTemplateInput) {
  const env = getServerEnv();
  const template = renderInvitationEmail(input);
  if (env.EMAIL_DELIVERY_MODE === "preview") {
    return { status: "captured" as const, providerMessageId: null };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  const result = await transport.sendMail({ from: env.EMAIL_FROM, to, ...template });
  return { status: "sent" as const, providerMessageId: result.messageId };
}
