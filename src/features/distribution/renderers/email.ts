import type { DistributionTemplate } from "../templates";

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailSignatureHtml(
  template: DistributionTemplate,
  publicToken: string,
  appUrl: string,
  orgName: string,
): string {
  const rc = (template.render_config ?? {}) as Record<string, unknown>;
  const ratingStyle = (rc.ratingStyle as string) ?? "emoji";
  const heading = (rc.headingEn as string) ?? "How was your experience?";
  const description = (rc.descriptionEn as string) ?? "";
  const brandColor = (rc.brandColor as string) ?? "#2563eb";
  const iconSize = (rc.iconSize as string) ?? "medium";
  const alignment = (rc.alignment as string) ?? "left";
  const showBusinessName = (rc.showBusinessName as boolean) ?? true;
  const showPrivacyNotice = (rc.showPrivacyNotice as boolean) ?? false;
  const privacyNotice = (rc.privacyNoticeEn as string) ?? "";
  const fontSize = iconSize === "large" ? "28" : iconSize === "small" ? "18" : "22";
  const alignStyle = alignment === "center" ? "text-align:center;" : alignment === "right" ? "text-align:right;" : "text-align:left;";
  const feedbackUrl = `${appUrl}/feedback/l/${publicToken}`;
  const encodedUrl = feedbackUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  let ratingHtml = "";
  if (ratingStyle === "emoji") {
    ratingHtml = Array.from({ length: 5 }, (_, i) => {
      const r = 5 - i;
      return `<a href="${encodedUrl}?r=${r}" style="text-decoration:none;font-size:${fontSize}px;letter-spacing:4px;display:inline-block;padding:2px 0;" target="_blank">${["&#128545;", "&#128542;", "&#128528;", "&#128578;", "&#128522;"][i]}</a>`;
    }).join("\n");
  } else if (ratingStyle === "star") {
    ratingHtml = Array.from({ length: 5 }, (_, i) => {
      const r = 5 - i;
      return `<a href="${encodedUrl}?r=${r}" style="text-decoration:none;color:${brandColor};font-size:${fontSize}px;display:inline-block;padding:2px;letter-spacing:2px;" target="_blank">&#9733;</a>`;
    }).join("\n");
  } else if (ratingStyle === "three_option") {
    ratingHtml = `<a href="${encodedUrl}?r=3" style="display:inline-block;background-color:#22c55e;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Great</a>
<a href="${encodedUrl}?r=2" style="display:inline-block;background-color:#f59e0b;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Okay</a>
<a href="${encodedUrl}?r=1" style="display:inline-block;background-color:#ef4444;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Poor</a>`;
  } else if (ratingStyle === "yes_no") {
    ratingHtml = `<a href="${encodedUrl}?r=5" style="display:inline-block;background-color:#22c55e;color:#fff;padding:8px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">Yes &#10003;</a>
<a href="${encodedUrl}?r=1" style="display:inline-block;background-color:#ef4444;color:#fff;padding:8px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin:2px;" target="_blank">No &#10007;</a>`;
  }

  const descriptionRow = description
    ? `<tr><td style="padding:0 0 4px 0;font-size:12px;color:#666;${alignStyle}">${escapeHtml(description)}</td></tr>`
    : "";
  const privacyRow = showPrivacyNotice && privacyNotice
    ? `<tr><td style="padding:4px 0 0 0;font-size:10px;color:#999;${alignStyle}">${escapeHtml(privacyNotice)}</td></tr>`
    : "";

  return `<!-- Feedback Distribution Link - Channel: email -->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;${alignStyle}">
${showBusinessName ? `<tr><td style="padding:0 0 2px 0;font-size:13px;font-weight:600;color:#333;${alignStyle}">${escapeHtml(orgName)}</td></tr>` : ""}
<tr><td style="padding:0 0 4px 0;font-size:13px;color:#333;${alignStyle}">${escapeHtml(heading)}</td></tr>
${descriptionRow}
<tr><td style="padding:4px 0 2px 0;${alignStyle}">${ratingHtml}</td></tr>
${privacyRow}
</table>`;
}

export function renderEmailSignaturePlainText(publicToken: string, appUrl: string, orgName: string, template: DistributionTemplate): string {
  const rc = (template.render_config ?? {}) as Record<string, unknown>;
  const heading = (rc.headingEn as string) ?? "How was your experience?";
  const description = (rc.descriptionEn as string) ?? "";
  const feedbackUrl = `${appUrl}/feedback/l/${publicToken}`;
  return `${orgName}\n${heading}\n${description ? description + "\n" : ""}\nHow did we do? Rate us here: ${feedbackUrl}`;
}
