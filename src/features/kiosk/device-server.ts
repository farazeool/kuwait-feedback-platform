"use server-only";

import { cookies } from "next/headers";
import { createSupabaseAnonymousClient } from "@/lib/supabase/anonymous";
import { publicSurveySchema } from "@/features/public-feedback/schema";
import type { KioskStatus } from "@/lib/kiosk/status";

export interface KioskDeviceState {
  device: {
    id: string;
    public_id: string;
    name: string;
    status: KioskStatus;
    location_id: string;
    survey_id: string | null;
    organization_id: string;
    last_seen_at: string | null;
  };
  survey: Awaited<ReturnType<typeof getPublicSurvey>> | null;
  organization: {
    id: string;
    name: { en: string | null; ar: string | null };
    branding: {
      primary_color: string;
      logo_url: string | null;
      footer: { en: string | null; ar: string | null } | null;
    };
  };
  location: {
    id: string;
    name: { en: string | null; ar: string | null };
  };
}

async function getPublicSurvey(publicId: string) {
  if (!/^[a-zA-Z0-9-]{24,128}$/.test(publicId)) return null;
  const supabase = createSupabaseAnonymousClient();
  const { data, error } = await supabase.rpc("get_public_survey", { p_public_slug: publicId });
  if (error) return null;
  const parsed = publicSurveySchema.safeParse(data);
  if (!parsed.success) return null;
  const logoPath = parsed.data.organization.branding.logo_path;
  const { data: signed } = logoPath
    ? await supabase.storage.from("organization-branding").createSignedUrl(logoPath, 3600)
    : { data: null };
  return {
    ...parsed.data,
    organization: {
      ...parsed.data.organization,
      branding: { ...parsed.data.organization.branding, logo_url: signed?.signedUrl ?? null },
    },
  };
}

// Type for kiosk_devices row with activation fields
// The generated types don't include new columns from migrations yet
interface KioskDeviceRow {
  id: string;
  public_id: string;
  name: string;
  status: string;
  location_id: string;
  survey_id: string | null;
  organization_id: string;
  last_seen_at: string | null;
  credential_hash: string | null;
}

interface OrganizationRow {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  branding: {
    primary_color?: string;
    logo_path?: string | null;
    footer?: { en?: string | null; ar?: string | null } | null;
  } | null;
}

interface LocationRow {
  id: string;
  name_en: string | null;
  name_ar: string | null;
}

/**
 * Get the current kiosk device state based on the credential cookie.
 * Returns null if:
 * - No credential cookie
 * - Invalid credential
 * - Device not found
 * - Device is revoked or archived
 */
export async function getKioskDeviceState(): Promise<KioskDeviceState | null> {
  const cookieStore = await cookies();
  const credential = cookieStore.get("kiosk_credential")?.value;

  if (!credential) {
    return null;
  }

  const supabase = createSupabaseAnonymousClient();

  // Look up device by credential hash
  // Use type assertion since the migration adds these columns but types aren't regenerated
  const { data: device, error: deviceError } = await supabase
    .from("kiosk_devices")
    .select("id, public_id, name, status, location_id, survey_id, organization_id, last_seen_at, credential_hash")
    .eq("credential_hash" as never, credential)
    .maybeSingle() as { data: KioskDeviceRow | null; error: unknown };

  if (deviceError || !device) {
    return null;
  }

  // Check for revoked or archived status
  if (device.status === "revoked" || device.status === "archived") {
    return null;
  }

  // Get organization and location in parallel
  const [orgResult, locationResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name_en, name_ar, branding")
      .eq("id", device.organization_id)
      .maybeSingle() as unknown as Promise<{ data: OrganizationRow | null; error: unknown }>,
    supabase
      .from("locations")
      .select("id, name_en, name_ar")
      .eq("id", device.location_id)
      .maybeSingle() as unknown as Promise<{ data: LocationRow | null; error: unknown }>,
  ]);

  if (!orgResult.data) {
    return null;
  }

  const organization = {
    id: orgResult.data.id,
    name: { en: orgResult.data.name_en, ar: orgResult.data.name_ar },
    branding: {
      primary_color: orgResult.data.branding?.primary_color || "#10b981",
      logo_url: orgResult.data.branding?.logo_path || null,
      footer: orgResult.data.branding?.footer
        ? { en: orgResult.data.branding.footer.en ?? null, ar: orgResult.data.branding.footer.ar ?? null }
        : null,
    },
  };

  const location = locationResult.data
    ? {
        id: locationResult.data.id,
        name: { en: locationResult.data.name_en, ar: locationResult.data.name_ar },
      }
    : { id: device.location_id, name: { en: "Unknown Location", ar: null } };

  // Get survey if assigned
  let survey: KioskDeviceState["survey"] = null;

  if (device.survey_id) {
    // Get the survey's public_slug to fetch full survey data
    const { data: surveyData } = await supabase
      .from("surveys")
      .select("public_slug")
      .eq("id", device.survey_id)
      .maybeSingle();

    if (surveyData?.public_slug) {
      survey = await getPublicSurvey(surveyData.public_slug);
    }
  }

  return {
    device: {
      id: device.id,
      public_id: device.public_id,
      name: device.name,
      status: device.status as KioskStatus,
      location_id: device.location_id,
      survey_id: device.survey_id,
      organization_id: device.organization_id,
      last_seen_at: device.last_seen_at,
    },
    survey,
    organization,
    location,
  };
}

/**
 * Clear the kiosk credential cookie.
 * Used when the device is revoked or needs to re-activate.
 */
export async function clearKioskCredential(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("kiosk_credential");
}