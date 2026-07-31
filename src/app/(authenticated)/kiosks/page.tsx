import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KioskManagement } from "./kiosk-management";
import type { KioskDevice, KioskLocation, KioskSurvey } from "./kiosk-management";

export default async function KiosksPage() {
  // Kiosk management is an organization-scoped admin surface, so reuse the same
  // guard as the other management pages. This also gives us the organization id
  // that list_kiosk_devices requires as its first argument.
  const context = await requireOrganizationManagementContext();
  const organizationId = context.membership?.organizationId ?? null;

  let devices: KioskDevice[] = [];
  let locations: KioskLocation[] = [];
  let surveys: KioskSurvey[] = [];
  let loadError: string | null = null;

  if (organizationId) {
    const supabase = await createSupabaseServerClient();

    // Fetching on the server keeps the initial render free of a data-loading
    // effect, so there is no cascading setState on mount. Mutations in the
    // client component call router.refresh() to re-run this query.
    const [devicesResult, locationsResult, surveysResult] = await Promise.all([
      supabase.rpc("list_kiosk_devices", { p_organization_id: organizationId }),
      supabase
        .from("locations")
        .select("id, name_en, name_ar")
        .eq("organization_id", organizationId)
        .order("name_en"),
      supabase
        .from("surveys")
        .select("id, title_en, title_ar, public_slug")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("title_en"),
    ]);

    const firstError =
      devicesResult.error ?? locationsResult.error ?? surveysResult.error;

    if (firstError) {
      console.error("Failed to load kiosk management data:", firstError);
      loadError = "Kiosk data could not be loaded. Please retry.";
    } else {
      devices = devicesResult.data ?? [];
      locations = locationsResult.data ?? [];
      surveys = surveysResult.data ?? [];
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Kiosk Device Management</h1>
        <p className="text-muted mt-2">
          Manage iPad kiosk devices, assign surveys, and monitor status across all locations.
        </p>
      </div>

      {!organizationId ? (
        // A platform admin without an organization membership has no single
        // organization to scope devices to; say so instead of calling the RPC
        // with a missing argument.
        <div className="text-center py-12 text-muted">
          Select an organization to manage its kiosk devices.
        </div>
      ) : loadError ? (
        <div className="text-center py-12 text-red-600">{loadError}</div>
      ) : (
        <KioskManagement
          devices={devices}
          locations={locations}
          surveys={surveys}
        />
      )}
    </div>
  );
}
