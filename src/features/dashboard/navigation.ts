import type { Database } from "@/types/database";
import type { MessageKey } from "@/lib/i18n/messages";

type AppRole = Database["public"]["Enums"]["app_role"];

export const DASHBOARD_NAVIGATION = [
  { href: "/dashboard", label: "nav.overview", roles: "all" },
  { href: "/dashboard/locations", label: "nav.locations", roles: "all" },
  { href: "/dashboard/surveys", label: "nav.surveys", roles: "all" },
  { href: "/dashboard/responses", label: "nav.responses", roles: "all" },
  { href: "/dashboard/alerts", label: "nav.alerts", roles: "all" },
  { href: "/dashboard/kpi", label: "nav.kpi", roles: "all" },
  {
    href: "/dashboard/team",
    label: "nav.team",
    roles: "all",
  },
  {
    href: "/dashboard/reports",
    label: "nav.reports",
    roles: ["platform_admin", "organization_owner", "organization_admin", "quality_manager", "senior_management"],
  },
  {
    href: "/dashboard/corrective-actions",
    label: "nav.correctiveActions",
    roles: ["platform_admin", "organization_owner", "organization_admin", "quality_manager"],
  },
  {
    href: "/dashboard/evidence",
    label: "nav.evidence",
    roles: ["platform_admin", "organization_owner", "organization_admin", "quality_manager", "location_manager"],
  },
  {
    href: "/dashboard/investigations",
    label: "nav.investigations",
    roles: ["platform_admin", "organization_owner", "organization_admin", "quality_manager", "senior_management"],
  },
  {
    href: "/dashboard/settings",
    label: "nav.settings",
    roles: ["platform_admin", "organization_owner", "organization_admin", "quality_manager"],
  },
  { href: "/dashboard/account", label: "nav.account", roles: "all" },
  { href: "/platform", label: "nav.platform", roles: ["platform_admin"] },
] as const satisfies ReadonlyArray<{
  href: string;
  label: MessageKey;
  roles: "all" | readonly AppRole[];
}>;

export function navigationForRole(role: AppRole) {
  return DASHBOARD_NAVIGATION.filter(
    (item) => item.roles === "all" || item.roles.some((allowedRole) => allowedRole === role),
  );
}
