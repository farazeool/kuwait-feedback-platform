import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KioskManagement, type KioskDevice, type KioskLocation, type KioskSurvey } from "@/app/(dashboard)/dashboard/kiosks/kiosk-management";

export default async function KiosksChannelPage() {
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
      // The list_kiosk_devices RPC returns a flattened view with activation status
      // Cast through unknown because the generated types don't include the new RPC return type yet
      devices = (devicesResult.data ?? []) as unknown as KioskDevice[];
      locations = locationsResult.data ?? [];
      surveys = surveysResult.data ?? [];
    }
  }

  // This page is nested under Settings → Channels, so it uses a more focused
  // header than the standalone Kiosks page.
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Settings → Channels
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Kiosk Devices
        </h1>
        <p className="mt-2 text-muted">
          Register and manage iPad kiosk devices for in-location feedback collection.
        </p>
      </header>

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
          organizationId={organizationId}
          devices={devices}
          locations={locations}
          surveys={surveys}
        />
      )}
    </div>
  );
}