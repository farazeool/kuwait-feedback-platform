export function buildFeedbackUrl(appUrl: string, publicSlug: string) {
  const base = new URL(appUrl);
  const url = new URL(`/feedback/${encodeURIComponent(publicSlug)}`, base);
  return url.toString();
}

export function isAllowedFeedbackUrl(value: string, appUrl: string) {
  try {
    const candidate = new URL(value);
    const base = new URL(appUrl);
    return candidate.origin === base.origin && candidate.pathname.startsWith("/feedback/");
  } catch {
    return false;
  }
}
