/**
 * Centralized host and URL configuration for the two production hostnames.
 *
 *   www.reviewandmore.tech        — public marketing website (Review & More)
 *   instaview.reviewandmore.tech  — secure operational workspace (InstaView)
 *
 * Every absolute URL the product emits (auth callbacks, password resets,
 * invitations, kiosk activation, rating links, email signatures, QR codes)
 * must be built through the helpers below so that production URLs are never
 * scattered across components.
 *
 * NEXT_PUBLIC_APP_URL remains the single source of truth for the operational
 * host — it is already consumed by the email, QR, invitation and kiosk
 * activation renderers, so pointing it at InstaView migrates every generated
 * link at once without touching those call sites.
 */

/** The exact application login route, resolved from src/app/(auth)/login/page.tsx. */
export const LOGIN_ROUTE = "/login" as const;
export const DASHBOARD_ROUTE = "/dashboard" as const;
export const AUTH_CALLBACK_ROUTE = "/auth/callback" as const;
export const RESET_PASSWORD_ROUTE = "/reset-password" as const;
export const KIOSK_ACTIVATION_ROUTE = "/kiosk/activate" as const;

export const PRODUCTION_MARKETING_HOST = "www.reviewandmore.tech" as const;
export const PRODUCTION_APP_HOST = "instaview.reviewandmore.tech" as const;

/**
 * Path prefixes that belong exclusively to the operational workspace. A request
 * for one of these on the marketing host is redirected to the equivalent
 * InstaView URL rather than rendered, so authenticated content can never leak
 * onto the public brand domain.
 */
export const APP_ONLY_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/onboarding",
  "/platform",
  "/invite",
  "/auth",
  "/kiosk",
] as const;

/**
 * Routes that must never be intercepted by host-based redirects: framework
 * internals, static assets, public feedback/rating submissions and every API
 * handler. Public collection must keep working regardless of which hostname a
 * kiosk, QR code or email signature was printed with.
 */
export const NEVER_REDIRECT_PREFIXES = [
  "/_next",
  "/api",
  "/f/",
  "/feedback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
] as const;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** Absolute base URL of the secure operational workspace (InstaView). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return trimTrailingSlash(configured && configured.length > 0 ? configured : "http://localhost:3000");
}

/**
 * Absolute base URL of the public marketing website. Falls back to the
 * application URL so local development and preview deployments — where a
 * separate marketing host does not exist — keep resolving to a real origin.
 */
export function getMarketingUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MARKETING_URL;
  return trimTrailingSlash(configured && configured.length > 0 ? configured : getAppUrl());
}

/** Join a path onto a base origin without producing duplicate slashes. */
function join(base: string, path: string): string {
  return `${trimTrailingSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildAppUrl(path: string): string {
  return join(getAppUrl(), path);
}

export function buildMarketingUrl(path: string): string {
  return join(getMarketingUrl(), path);
}

/**
 * Absolute login URL on InstaView. `next` is preserved so a deep link into the
 * workspace survives authentication.
 */
export function buildLoginUrl(next?: string): string {
  const base = buildAppUrl(LOGIN_ROUTE);
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

export function buildDashboardUrl(path = ""): string {
  return buildAppUrl(path ? `${DASHBOARD_ROUTE}${path.startsWith("/") ? path : `/${path}`}` : DASHBOARD_ROUTE);
}

export function buildAuthCallbackUrl(next?: string): string {
  const base = buildAppUrl(AUTH_CALLBACK_ROUTE);
  if (!next) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

export function buildPasswordResetUrl(): string {
  return buildAuthCallbackUrl(RESET_PASSWORD_ROUTE);
}

export function buildKioskActivationUrl(activationCode: string): string {
  return `${buildAppUrl(KIOSK_ACTIVATION_ROUTE)}?code=${encodeURIComponent(activationCode)}`;
}

/** Employee email-signature rating link (opaque public token). */
export function buildRatingUrl(publicToken: string): string {
  return buildAppUrl(`/f/${encodeURIComponent(publicToken)}`);
}

/** Public survey link used by QR codes and shared URLs. */
export function buildSurveyUrl(publicSlug: string): string {
  return buildAppUrl(`/feedback/${encodeURIComponent(publicSlug)}`);
}

// --- Host classification ---------------------------------------------------

export type HostKind = "marketing" | "app" | "local";

/**
 * Classify an incoming request hostname.
 *
 * Only the exact production marketing host is treated as marketing. Everything
 * else — InstaView, Vercel preview deployments, localhost and unknown hosts —
 * is treated as the application, which fails safe: an unrecognized host serves
 * the authenticated product behind its normal guards rather than silently
 * exposing the marketing site on an unexpected origin.
 */
export function classifyHost(hostname: string | null | undefined): HostKind {
  if (!hostname) return "app";
  const host = hostname.split(":")[0].toLowerCase();
  if (host === PRODUCTION_MARKETING_HOST) return "marketing";
  if (host === PRODUCTION_APP_HOST) return "app";
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") return "local";
  return "app";
}

export function isNeverRedirectPath(pathname: string): boolean {
  return NEVER_REDIRECT_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Decide whether a request on the marketing host must be handed off to
 * InstaView. Returns the absolute destination, or null to render normally.
 *
 * Query strings are preserved so `?next=`, `?code=` and language parameters
 * survive the hop between hostnames.
 */
export function resolveMarketingRedirect(pathname: string, search = ""): string | null {
  if (isNeverRedirectPath(pathname)) return null;
  if (!isAppOnlyPath(pathname)) return null;
  return `${buildAppUrl(pathname)}${search}`;
}

/**
 * Decide what the root path serves for a given hostname.
 *
 * On InstaView, `/` is the workspace entry point rather than a marketing page,
 * so it is handed to the dashboard. The dashboard's existing server-side guard
 * (requireAppAccessContext) then sends signed-out visitors to the login route
 * and signed-in users without an organization to onboarding. Routing it this
 * way keeps exactly one copy of the authorization rules and means the edge
 * never reads a session.
 *
 * The marketing host and localhost render the marketing homepage in place, so
 * local development stays usable with no DNS or hosts-file changes.
 *
 * Returns a relative path (never an absolute URL), so the visitor stays on the
 * InstaView origin and no redirect loop is possible: `/dashboard` is not `/`.
 */
export function resolveAppRootDestination(host: HostKind, pathname: string): string | null {
  if (pathname !== "/") return null;
  return host === "app" ? DASHBOARD_ROUTE : null;
}
