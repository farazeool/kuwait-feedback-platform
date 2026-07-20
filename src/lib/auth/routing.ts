export type AuthRouteState = {
  authenticated: boolean;
  hasPlatformAccess: boolean;
  membershipCount: number;
};

export type ProtectedDestination = "/login" | "/onboarding" | "allow";

export function resolveProtectedDestination(
  state: AuthRouteState,
): ProtectedDestination {
  if (!state.authenticated) return "/login";
  if (!state.hasPlatformAccess && state.membershipCount === 0) {
    return "/onboarding";
  }
  return "allow";
}
