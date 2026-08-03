import { NextResponse, type NextRequest } from "next/server";

import { classifyHost, resolveAppRootDestination, resolveMarketingRedirect } from "@/lib/config/domains";

/**
 * Host-aware routing between the public marketing website and the InstaView
 * workspace.
 *
 * This middleware deliberately does the smallest amount of work that is safe:
 * it performs no database query, reads no session and touches no cookie. The
 * only decision it makes is whether an operational path was requested on the
 * public marketing hostname, in which case it is handed off to InstaView.
 *
 * Authentication remains entirely in the existing server-side guards
 * (requireAppAccessContext and friends), so there is no second, weaker copy of
 * the authorization rules running at the edge.
 *
 * The matcher below excludes Next.js internals and static assets; the domain
 * helper additionally refuses to redirect API routes, auth callbacks, public
 * feedback/rating submissions and kiosk device traffic.
 */
export function middleware(request: NextRequest) {
  const host = classifyHost(request.headers.get("host") ?? request.nextUrl.hostname);

  if (host !== "marketing") {
    // On InstaView, "/" is the workspace entry point rather than a marketing
    // page. Rewriting it to the dashboard lets the existing server-side guard
    // decide between the dashboard, onboarding and the login route, so no
    // session is read here and there is only one copy of those rules.
    const appRoot = resolveAppRootDestination(host, request.nextUrl.pathname);
    if (appRoot) {
      const url = request.nextUrl.clone();
      url.pathname = appRoot;
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  const destination = resolveMarketingRedirect(request.nextUrl.pathname, request.nextUrl.search);
  if (!destination) return NextResponse.next();

  // 307 preserves the request method, so a form POST that lands on the wrong
  // hostname is not silently downgraded to a GET.
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
