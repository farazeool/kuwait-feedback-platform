export type InvitationTemplateInput = {
  locale: "en" | "ar";
  organizationName: string;
  role: string;
  expiresAt: string;
  acceptanceUrl: string;
  personalMessage?: string | null;
  primaryColor?: string;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderInvitationEmail(input: InvitationTemplateInput) {
  const ar = input.locale === "ar";
  const direction = ar ? "rtl" : "ltr";
  const subject = ar ? `دعوة للانضمام إلى ${input.organizationName}` : `Invitation to join ${input.organizationName}`;
  const heading = ar ? "تمت دعوتك للانضمام إلى فريق" : "You have been invited to join";
  const roleLabel = ar ? "الدور" : "Role";
  const expiryLabel = ar ? "تنتهي الدعوة" : "Invitation expires";
  const action = ar ? "قبول الدعوة" : "Accept invitation";
  const safeMessage = input.personalMessage ? escapeHtml(input.personalMessage) : "";
  const html = `<!doctype html><html lang="${input.locale}" dir="${direction}"><body style="font-family:Arial,sans-serif;background:#f6f7f8;padding:24px"><main style="max-width:560px;margin:auto;background:white;border-radius:16px;padding:28px"><h1>${heading} ${escapeHtml(input.organizationName)}</h1><p><strong>${roleLabel}:</strong> ${escapeHtml(input.role.replaceAll("_", " "))}</p><p><strong>${expiryLabel}:</strong> ${escapeHtml(input.expiresAt)}</p>${safeMessage ? `<blockquote>${safeMessage}</blockquote>` : ""}<p><a href="${escapeHtml(input.acceptanceUrl)}" style="display:inline-block;background:${input.primaryColor ?? "#065f46"};color:white;padding:12px 18px;border-radius:10px;text-decoration:none">${action}</a></p></main></body></html>`;
  const text = `${heading} ${input.organizationName}\n${roleLabel}: ${input.role}\n${expiryLabel}: ${input.expiresAt}\n${input.personalMessage ?? ""}\n${action}: ${input.acceptanceUrl}`;
  return { subject, html, text };
}
