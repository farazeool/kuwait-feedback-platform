import { NextResponse, type NextRequest } from "next/server";

import {
  classifyHost,
  resolveAppRootDestination,
  resolveMarketingRedirect,
} from "@/lib/config/domains";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Single request-interception layer for the deployment.
 *
 * Two concerns are handled here, in a deliberate order:
 *
 * 1. Host routing between the public marketing website
 *    (www.reviewandmore.tech) and the InstaView workspace
 *    (instaview.reviewandmore.tech).
 * 2. Supabase session refresh, which is the pre-existing behaviour and must
 *    keep running for every operational request.
 *
 * Host routing runs first so that a request landing on the marketing hostname
 * is handed off to InstaView *before* any Supabase cookie work happens. That
 * keeps auth cookies host-only to the workspace domain and means the marketing
 * site never touches a session.
 *
 * No database query is performed here and no authorization decision is made.
 * Authentication remains entirely in the existing server-side guards, so there
 * is no second, weaker copy of those rules running at the edge.
 */
export async function proxy(request: NextRequest) {
  const host = classifyHost(
    request.headers.get("host") ?? request.nextUrl.hostname,
  );

  if (host === "marketing") {
    const destination = resolveMarketingRedirect(
      request.nextUrl.pathname,
      request.nextUrl.search,
    );

    // 307 preserves the request method, so a form POST that lands on the wrong
    // hostname is not silently downgraded to a GET.
    if (destination) return NextResponse.redirect(destination, 307);

    // Marketing pages are public and stateless: skip the session refresh so no
    // Supabase cookie is ever set on the marketing hostname.
    return NextResponse.next();
  }

  // On InstaView, "/" is the workspace entry point rather than a marketing
  // page. Redirecting it lets the existing server-side guard decide between the
  // dashboard, onboarding and the login route, so no session is read here and
  // there is only one copy of those rules.
  const appRoot = resolveAppRootDestination(host, request.nextUrl.pathname);
  if (appRoot) {
    const url = request.nextUrl.clone();
    url.pathname = appRoot;
    return NextResponse.redirect(url, 307);
  }

  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
