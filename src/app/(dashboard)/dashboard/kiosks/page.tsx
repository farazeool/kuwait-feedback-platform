import { requireOrganizationManagementContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  KioskFleetList,
  type FleetActivityRow,
  type FleetKiosk,
} from "./kiosk-fleet-list";
import { KioskManagement } from "./kiosk-management";
import type {
  KioskDevice,
  KioskLocation,
  KioskSurvey,
} from "./kiosk-management";

export default async function KiosksPage() {
  // Kiosk management is an organization-scoped admin surface, so reuse the same
  // guard as the other management pages. This also gives us the organization id
  // that list_kiosk_fleet requires as its first argument.
  const context = await requireOrganizationManagementContext();
  const organizationId = context.membership?.organizationId ?? null;

  let fleet: FleetKiosk[] = [];
  let activity: FleetActivityRow[] = [];
  let totalActivityCount = 0;
  let fleetLoadError: string | null = null;
  let activityLoadError: string | null = null;

  if (organizationId) {
    const supabase = await createSupabaseServerClient();

    // Fetching on the server keeps the initial render free of a data-loading
    // effect, so there is no cascading setState on mount. Mutations in the
    // client component call router.refresh() to re-run this query.
    const [fleetResult, activityResult] = await Promise.all([
      supabase.rpc("list_kiosk_fleet", {
        p_organization_id: organizationId,
      }),
      supabase.rpc("list_kiosk_activity", {
        p_organization_id: organizationId,
        p_limit: 50,
        p_offset: 0,
      }),
    ]);

    if (fleetResult.error) {
      console.error("Failed to load kiosk fleet:", fleetResult.error);
      fleetLoadError =
        fleetResult.error.message?.toLowerCase().includes("not authorized")
          ? "You are not authorized to view this organization's fleet."
          : "Kiosk fleet could not be loaded. Please retry.";
    } else {
      fleet = (fleetResult.data ?? []) as unknown as FleetKiosk[];
    }

    if (activityResult.error) {
      console.error("Failed to load kiosk activity:", activityResult.error);
      activityLoadError = "Recent activity could not be loaded. Please retry.";
    } else {
      const rows = (activityResult.data ?? []) as unknown as Array<
        FleetActivityRow & { total_count: number }
      >;
      activity = rows;
      totalActivityCount = rows[0]?.total_count ?? rows.length;
    }
  }

  // The dashboard layout already supplies the sidebar, topbar, page padding and
  // the dir/lang wrapper, so this page only owns its own content stack. Match
  // the "grid gap-6" + header idiom the sibling dashboard pages use.
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Device fleet
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Kiosks
        </h1>
        <p className="mt-2 text-muted">
          Manage iPad kiosk devices, assign surveys, and monitor status across all locations.
        </p>
      </header>

      {!organizationId ? (
        <div className="text-center py-12 text-muted">
          Select an organization to manage its kiosk devices.
        </div>
      ) : fleetLoadError ? (
        <div className="text-center py-12 text-red-600">{fleetLoadError}</div>
      ) : (
        <>
          <KioskFleetList
            organizationId={organizationId}
            initialFleet={fleet}
            initialActivity={activity}
            totalActivityCount={totalActivityCount}
          />
          {activityLoadError ? (
            <p
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {activityLoadError}
            </p>
          ) : null}
          {/* The legacy enrollment / credential management surface remains
              available for kiosks that haven't been onboarded yet. The new
              fleet view is the canonical state for active kiosks. */}
          <KioskManagementBootstrap />
        </>
      )}
    </div>
  );
}

/**
 * Renders the legacy <KioskManagement /> island only when there is at least
 * one kiosk in the fleet, so the page keeps both surfaces (the existing
 * credential issuance / activation code flow) without overwhelming new
 * installs with empty-state UI. The fleet list is the primary surface.
 */
function KioskManagementBootstrap() {
  return (
    <details className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <summary className="cursor-pointer text-foreground">
        Enrollment &amp; setup tools
      </summary>
      <div className="mt-3">
        <KioskManagementEmbedded />
      </div>
    </details>
  );
}

function KioskManagementEmbedded() {
  // Re-render the legacy management client with empty initial data so the
  // detail section is self-contained. Users who need to onboard a new
  // device can still use the existing flows.
  return (
    <KioskManagement
      organizationId=""
      devices={[] as KioskDevice[]}
      locations={[] as KioskLocation[]}
      surveys={[] as KioskSurvey[]}
    />
  );
}
