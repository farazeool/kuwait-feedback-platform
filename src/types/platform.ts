import type { PLATFORM_ROLES, SUPPORTED_LOCALES } from "@/lib/config/platform";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
