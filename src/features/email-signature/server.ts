import "server-only";

export function buildEmailSignatureLink(params: {
  appUrl: string;
  publicSlug: string;
  touchpointToken?: string;
  campaignId?: string;
  employeeRef?: string;
  interactionRef?: string;
}): string {
  const url = new URL(`/feedback/${encodeURIComponent(params.publicSlug)}`, params.appUrl);
  const qp = new URLSearchParams();
  if (params.touchpointToken) qp.set("t", params.touchpointToken);
  if (params.campaignId) qp.set("c", params.campaignId);
  if (params.employeeRef) qp.set("e", params.employeeRef);
  if (params.interactionRef) qp.set("r", params.interactionRef);
  const qs = qp.toString();
  return qs ? `${url.toString()}?${qs}` : url.toString();
}

export function buildEmailSignatureHtml(params: {
  appUrl: string;
  publicSlug: string;
  organizationName: string;
  ratingStyle: "emoji" | "star";
  brandColor?: string;
}): string {
  const feedbackUrl = buildEmailSignatureLink({
    appUrl: params.appUrl,
    publicSlug: params.publicSlug,
  });
  const color = params.brandColor ?? "#2563eb";
  const encodedUrl = feedbackUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  if (params.ratingStyle === "star") {
    return `<a href="${encodedUrl}" style="display:inline-block;text-decoration:none;color:${color};font-size:18px;line-height:1;padding:4px 0;" target="_blank">
  &#9733;&#9733;&#9733;&#9733;&#9733;
  <span style="display:block;font-size:11px;color:#666;margin-top:2px;">How did we do? Tap to rate</span>
</a>`;
  }

  // Default emoji style
  return `<a href="${encodedUrl}" style="display:inline-block;text-decoration:none;font-size:20px;line-height:1;padding:4px 0;letter-spacing:3px;" target="_blank">
  &#128522; &#128578; &#128528; &#128542; &#128545;
  <span style="display:block;font-size:11px;color:#666;margin-top:2px;">${params.organizationName} &mdash; How did we do? Tap to rate</span>
</a>`;
}
