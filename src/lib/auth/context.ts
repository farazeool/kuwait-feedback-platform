import "server-only";

import { redirect } from "next/navigation";

import { resolveProtectedDestination } from "@/lib/auth/routing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];
type MembershipScope = Database["public"]["Enums"]["membership_scope"];

export type AppAccessContext = {
  user: { id: string; email: string | null };
  profile: {
    displayName: string;
    locale: "en" | "ar";
    platformRole: AppRole | null;
  };
  membership: {
    organizationId: string;
    role: AppRole;
    scope: MembershipScope;
  } | null;
  organization: {
    id: string;
    nameEn: string;
    nameAr: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string;
  } | null;
  locations: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    area: string;
    governorate: string;
  }>;
};

export async function getAppAccessContext(): Promise<AppAccessContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, preferred_locale, platform_role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, role, scope")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  const membership = memberships?.[0] ?? null;
  let organization: AppAccessContext["organization"] = null;
  let locations: AppAccessContext["locations"] = [];

  if (membership) {
    const [{ data: organizationRow }, { data: locationRows }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name_en, name_ar, slug, logo_path, primary_color")
        .eq("id", membership.organization_id)
        .maybeSingle(),
      supabase
        .from("locations")
        .select("id, name_en, name_ar, area, governorate")
        .eq("organization_id", membership.organization_id)
        .eq("status", "active")
        .order("name_en"),
    ]);

    if (organizationRow) {
      const { data: signedLogo } = organizationRow.logo_path
        ? await supabase.storage.from("organization-branding").createSignedUrl(organizationRow.logo_path, 3600)
        : { data: null };
      organization = {
        id: organizationRow.id,
        nameEn: organizationRow.name_en,
        nameAr: organizationRow.name_ar,
        slug: organizationRow.slug,
        logoUrl: signedLogo?.signedUrl ?? null,
        primaryColor: organizationRow.primary_color,
      };
    }
    locations = (locationRows ?? []).map((location) => ({
      id: location.id,
      nameEn: location.name_en,
      nameAr: location.name_ar,
      area: location.area,
      governorate: location.governorate,
    }));
  } else if (profile?.platform_role === "platform_admin") {
    const { data: organizationRow } = await supabase
      .from("organizations")
      .select("id, name_en, name_ar, slug, logo_path, primary_color")
      .eq("status", "active")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (organizationRow) {
      const { data: signedLogo } = organizationRow.logo_path
        ? await supabase.storage.from("organization-branding").createSignedUrl(organizationRow.logo_path, 3600)
        : { data: null };
      organization = {
        id: organizationRow.id,
        nameEn: organizationRow.name_en,
        nameAr: organizationRow.name_ar,
        slug: organizationRow.slug,
        logoUrl: signedLogo?.signedUrl ?? null,
        primaryColor: organizationRow.primary_color,
      };
    }
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: {
      displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "User",
      locale: profile?.preferred_locale ?? "en",
      platformRole: profile?.platform_role ?? null,
    },
    membership: membership
      ? {
          organizationId: membership.organization_id,
          role: membership.role,
          scope: membership.scope,
        }
      : null,
    organization,
    locations,
  };
}

export async function requireAppAccessContext() {
  const context = await getAppAccessContext();
  const destination = resolveProtectedDestination({
    authenticated: Boolean(context),
    hasPlatformAccess: context?.profile.platformRole === "platform_admin",
    membershipCount: context?.membership ? 1 : 0,
  });

  if (destination !== "allow") redirect(destination);
  return context as AppAccessContext;
}

export async function requireOnboardingUser() {
  const context = await getAppAccessContext();
  if (!context) redirect("/login");
  if (context.membership || context.profile.platformRole === "platform_admin") {
    redirect("/dashboard");
  }
  return context;
}

export async function requireOrganizationManagementContext() {
  const context = await requireAppAccessContext();
  const role = context.profile.platformRole ?? context.membership?.role;
  if (!role || !["platform_admin", "organization_owner", "organization_admin"].includes(role)) {
    redirect("/dashboard");
  }
  return context;
}

export async function requirePlatformAdminContext() {
  const context = await requireAppAccessContext();
  if (context.profile.platformRole !== "platform_admin") redirect("/dashboard");
  return context;
}
