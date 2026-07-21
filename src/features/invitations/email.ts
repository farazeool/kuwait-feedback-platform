import "server-only";

import nodemailer from "nodemailer";

import { renderInvitationEmail, type InvitationTemplateInput } from "./email-template";
import { getServerEnv } from "@/lib/env/server";
import { logError } from "@/lib/observability/logger";

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
    auth: env.SMTP_USERNAME && env.SMTP_PASSWORD ? { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 5_000,
    socketTimeout: 10_000,
  });
  try {
    const result = await transport.sendMail({ from: { address: env.SMTP_FROM_EMAIL, name: env.SMTP_FROM_NAME }, to, ...template });
    return { status: "sent" as const, providerMessageId: result.messageId };
  } catch (error) {
    logError("invitation_delivery_failed", { reason: error instanceof Error ? error.name : "unknown" });
    throw new Error("Invitation delivery failed");
  }
}
