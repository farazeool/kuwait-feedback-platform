import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];

export const DASHBOARD_NAVIGATION = [
  { href: "/dashboard", label: "Overview", roles: "all" },
  { href: "/dashboard/locations", label: "Locations", roles: "all" },
  { href: "/dashboard/surveys", label: "Surveys", roles: "all" },
  { href: "/dashboard/responses", label: "Responses", roles: "all" },
  {
    href: "/dashboard/team",
    label: "Team",
    roles: ["platform_admin", "organization_owner", "organization_admin"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    roles: ["platform_admin", "organization_owner", "organization_admin"],
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  roles: "all" | readonly AppRole[];
}>;

export function navigationForRole(role: AppRole) {
  return DASHBOARD_NAVIGATION.filter(
    (item) => item.roles === "all" || item.roles.some((allowedRole) => allowedRole === role),
  );
}
