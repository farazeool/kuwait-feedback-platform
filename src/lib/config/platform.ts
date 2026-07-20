export const APP_TIME_ZONE = "Asia/Kuwait" as const;

export const SUPPORTED_LOCALES = ["en", "ar"] as const;

export const PLATFORM_ROLES = [
  "platform_admin",
  "organization_owner",
  "organization_admin",
  "location_manager",
  "analyst",
] as const;

export const PLATFORM_FEATURES = [
  {
    title: "Multi-location surveys",
    description: "QR-ready public survey links scoped to each business location.",
  },
  {
    title: "Tenant-safe access",
    description: "Role-based permissions backed by PostgreSQL Row Level Security.",
  },
  {
    title: "Actionable insights",
    description: "Ratings, trends, branch comparisons, and low-score alert foundations.",
  },
] as const;
