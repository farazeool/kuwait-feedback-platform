import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];

export function canManageSurveyStructure(role: AppRole) {
  return ["platform_admin", "organization_owner", "organization_admin"].includes(role);
}

export function canViewSurvey(role: AppRole) {
  return [
    "platform_admin",
    "organization_owner",
    "organization_admin",
    "location_manager",
    "analyst",
  ].includes(role);
}
