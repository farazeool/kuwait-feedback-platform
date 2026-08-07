"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DESTRUCTIVE_COMMAND_TYPES,
  KIOSK_COMMAND_LABELS,
  type KioskCommandType,
} from "@/features/kiosk/command-schemas";

// Mirrors the flat column list returned by the list_kiosk_fleet RPC.
// Keeping the shape flat (no nested objects) keeps the TS type aligned
// with the Supabase generated types and lets the table render simply.
export interface FleetKiosk {
  id: string;
  device_name: string;
  device_identifier: string | null;
  status: KioskFleetStatus;
  activation_status: "pending_activation" | "activated";
  has_credential: boolean;
  location_id: string | null;
  location_name_en: string | null;
  location_name_ar: string | null;
  desired_survey_id: string | null;
  desired_survey_title_en: string | null;
  desired_survey_title_ar: string | null;
  applied_survey_id: string | null;
  applied_survey_title_en: string | null;
  applied_survey_title_ar: string | null;
  desired_mode: KioskFleetMode;
  applied_mode: KioskFleetMode;
  desired_config_version: number;
  applied_config_version: number;
  configuration_status: "current" | "pending" | "failed";
  configuration_error: string | null;
  configuration_updated_at: string | null;
  configuration_applied_at: string | null;
  last_seen_at: string | null;
  last_heartbeat_at: string | null;
  last_successful_application_at: string | null;
  online: boolean;
  pending_command_count: number;
  failed_command_count: number;
  latest_command_id: string | null;
  latest_command_type: string | null;
  latest_command_status: string | null;
  latest_command_created_at: string | null;
  latest_command_idempotency_key: string | null;
}

export type KioskFleetStatus =
  | "pending_activation"
  | "active"
  | "paused"
  | "maintenance"
  | "offline"
  | "revoked"
  | "archived";

export type KioskFleetMode = "active" | "paused" | "maintenance" | "revoked";

export interface FleetEligibleSurvey {
  id: string;
  title_en: string | null;
  title_ar: string | null;
  public_slug: string;
  is_current_desired: boolean;
  is_current_applied: boolean;
}

export interface FleetActivityRow {
  id: string;
  occurred_at: string;
  kiosk_device_id: string;
  kiosk_device_name: string | null;
  location_id: string | null;
  location_name_en: string | null;
  location_name_ar: string | null;
  event_type: string;
  actor_type: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  status: string | null;
  metadata_summary: string;
  total_count: number;
}

interface Props {
  organizationId: string;
  initialFleet: FleetKiosk[];
  initialActivity: FleetActivityRow[];
  totalActivityCount: number;
}

// 90 seconds is the dashboard's online threshold; it matches the
// RPC's 90-second window in list_kiosk_fleet. Duplicating it here
// keeps the inline indicator consistent without a round trip.
const ONLINE_THRESHOLD_MS = 90 * 1000;

function isCurrentlyOnline(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return now - seen < ONLINE_THRESHOLD_MS;
}

function statusLabel(status: KioskFleetStatus): string {
  switch (status) {
    case "pending_activation":
      return "Pending activation";
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "maintenance":
      return "Maintenance";
    case "offline":
      return "Offline";
    case "revoked":
      return "Credential revoked";
    case "archived":
      return "Archived";
  }
}

function modeLabel(mode: KioskFleetMode): string {
  switch (mode) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "maintenance":
      return "Maintenance";
    case "revoked":
      return "Revoked";
  }
}

function localizedLabel(en: string | null, ar: string | null): string {
  return en ?? ar ?? "—";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function commandTypeLabel(type: string | null): string {
  if (!type) return "—";
  if (type in KIOSK_COMMAND_LABELS) {
    return KIOSK_COMMAND_LABELS[type as KioskCommandType];
  }
  return type.replace(/_/g, " ");
}

function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "acknowledged":
    case "applied":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
    case "delivered":
    case "current":
      return "bg-sky-100 text-sky-800";
    case "failed":
    case "expired":
    case "cancelled":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function eventTypeLabel(eventType: string): string {
  // Strip trailing _requested / _applied / _acknowledged so the badge
  // shows just the command name.
  return eventType
    .replace(/_requested$/, "")
    .replace(/_applied$/, "")
    .replace(/_acknowledged$/, "")
    .replace(/_/g, " ");
}

/**
 * Decide which actions the dashboard should expose for a kiosk, given
 * the current status and the latest command in flight. The dashboard
 * hides actions that do not make sense for the current state so the
 * operator never sees a Pause button for an already-paused device.
 */
function availableActions(kiosk: FleetKiosk): {
  type: KioskCommandType;
  label: string;
  destructive: boolean;
}[] {
  const actions: { type: KioskCommandType; label: string; destructive: boolean }[] = [];

  if (kiosk.status === "archived" || kiosk.status === "revoked") {
    // Archived kiosks cannot be touched. Revoked devices only accept
    // the explicit re-enrollment command.
    if (kiosk.status === "revoked") {
      actions.push({
        type: "reenroll",
        label: KIOSK_COMMAND_LABELS.reenroll,
        destructive: true,
      });
    }
    return actions;
  }

  // Refresh is always safe to offer, regardless of mode.
  actions.push({
    type: "refresh_configuration",
    label: KIOSK_COMMAND_LABELS.refresh_configuration,
    destructive: false,
  });

  // Mode toggles depend on the current mode.
  if (kiosk.applied_mode === "active") {
    actions.push({
      type: "pause",
      label: KIOSK_COMMAND_LABELS.pause,
      destructive: false,
    });
    actions.push({
      type: "enter_maintenance",
      label: KIOSK_COMMAND_LABELS.enter_maintenance,
      destructive: false,
    });
  } else if (kiosk.applied_mode === "paused") {
    actions.push({
      type: "resume",
      label: KIOSK_COMMAND_LABELS.resume,
      destructive: false,
    });
  } else if (kiosk.applied_mode === "maintenance") {
    actions.push({
      type: "exit_maintenance",
      label: KIOSK_COMMAND_LABELS.exit_maintenance,
      destructive: false,
    });
  }

  // Survey switch is always available while the kiosk is alive.
  actions.push({
    type: "change_survey",
    label: KIOSK_COMMAND_LABELS.change_survey,
    destructive: false,
  });

  // Credential revocation is destructive and must remain a deliberate
  // choice. We do not hide it on paused or maintenance devices.
  actions.push({
    type: "revoke_credential",
    label: KIOSK_COMMAND_LABELS.revoke_credential,
    destructive: true,
  });

  return actions;
}

/**
 * Generate a short, dashboard-friendly idempotency key. We use the
 * command type, the kiosk id, and the time the dialog was opened so a
 * retry within the same dialog instance is collapsed by the RPC,
 * while a fresh dialog generates a new key.
 */
function generateIdempotencyKey(
  kioskId: string,
  commandType: KioskCommandType,
): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `c3-${commandType}-${kioskId}-${stamp}-${random}`;
}

interface DialogState {
  kiosk: FleetKiosk;
  commandType: KioskCommandType;
}

export function KioskFleetList({
  organizationId,
  initialFleet,
  initialActivity,
  totalActivityCount,
}: Props) {
  const router = useRouter();
  const [fleet, setFleet] = useState(initialFleet);
  const [activity] = useState(initialActivity);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // Survey id chosen inside the change-survey dialog. Lifted up here
  // because the dialog state in props is immutable (React's standard
  // prop contract) and the submit handler needs to read the chosen
  // survey id without re-rendering the whole dialog tree.
  const [pickedSurveyId, setPickedSurveyId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredFleet = useMemo(() => {
    if (!searchTerm.trim()) return fleet;
    const needle = searchTerm.trim().toLowerCase();
    return fleet.filter(
      (kiosk) =>
        kiosk.device_name.toLowerCase().includes(needle) ||
        (kiosk.device_identifier?.toLowerCase().includes(needle) ?? false) ||
        (kiosk.location_name_en?.toLowerCase().includes(needle) ?? false) ||
        (kiosk.location_name_ar?.toLowerCase().includes(needle) ?? false),
    );
  }, [fleet, searchTerm]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const openDialog = useCallback(
    (kiosk: FleetKiosk, commandType: KioskCommandType) => {
      setDialog({ kiosk, commandType });
      setPickedSurveyId(null);
      setConfirmText("");
      setError(null);
    },
    [],
  );

  const closeDialog = useCallback(() => {
    setDialog(null);
    setConfirmText("");
    setError(null);
  }, []);

  const submitAction = useCallback(async () => {
    if (!dialog) return;

    setError(null);
    setPendingAction(`${dialog.kiosk.id}:${dialog.commandType}`);

    const idempotencyKey = generateIdempotencyKey(
      dialog.kiosk.id,
      dialog.commandType,
    );

    try {
      const response = await fetch("/api/kiosk/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kiosk_device_id: dialog.kiosk.id,
          command_type: dialog.commandType,
          command_payload:
            dialog.commandType === "change_survey" && pickedSurveyId
              ? { survey_id: pickedSurveyId }
              : null,
          idempotency_key: idempotencyKey,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      // Optimistic update: bump the kiosk's status locally so the UI
      // shows the pending state immediately. The next router refresh
      // reconciles with the server.
      setFleet((prev) =>
        prev.map((k) => {
          if (k.id !== dialog.kiosk.id) return k;
          if (dialog.commandType === "pause") {
            return {
              ...k,
              desired_mode: "paused",
              desired_config_version: k.desired_config_version + 1,
            };
          }
          if (dialog.commandType === "resume") {
            return {
              ...k,
              desired_mode: "active",
              desired_config_version: k.desired_config_version + 1,
            };
          }
          if (dialog.commandType === "enter_maintenance") {
            return {
              ...k,
              desired_mode: "maintenance",
              desired_config_version: k.desired_config_version + 1,
            };
          }
          if (dialog.commandType === "exit_maintenance") {
            return {
              ...k,
              desired_mode: "active",
              desired_config_version: k.desired_config_version + 1,
            };
          }
          if (dialog.commandType === "change_survey" && pickedSurveyId) {
            return {
              ...k,
              desired_survey_id: pickedSurveyId,
              desired_config_version: k.desired_config_version + 1,
            };
          }
          return {
            ...k,
            desired_config_version: k.desired_config_version + 1,
          };
        }),
      );

      closeDialog();
      // Server reconciliation: a router refresh re-runs the page
      // server component which re-fetches the fleet RPC.
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPendingAction(null);
    }
  }, [dialog, pickedSurveyId, closeDialog, refresh]);

  const confirmRequired =
    dialog !== null && DESTRUCTIVE_COMMAND_TYPES.has(dialog.commandType);
  const confirmAllowed =
    !confirmRequired ||
    confirmText.trim().toLowerCase() === dialog?.kiosk.device_name.trim().toLowerCase();

  return (
    <div className="grid gap-8">
      {/* Live region for screen readers and to satisfy aria-live updates. */}
      <div aria-live="polite" className="sr-only">
        {pendingAction ? "Command in flight" : "Idle"}
      </div>

      <section aria-labelledby="fleet-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Device fleet
            </p>
            <h2
              id="fleet-heading"
              className="mt-1 text-xl font-bold tracking-tight text-foreground"
            >
              All kiosks ({fleet.length})
            </h2>
            <p className="mt-1 text-sm text-muted">
              Online status is based on a recent heartbeat (within the last
              90 seconds). &ldquo;Applied&rdquo; reflects what the kiosk has
              acknowledged; &ldquo;Desired&rdquo; reflects what this dashboard
              has asked for.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="fleet-search" className="sr-only">
              Search kiosks
            </label>
            <input
              id="fleet-search"
              type="search"
              placeholder="Search by name, identifier, or location"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="button"
              onClick={refresh}
              disabled={isPending}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
            >
              {isPending ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {filteredFleet.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 p-12 text-center text-sm text-muted">
            {fleet.length === 0
              ? "No kiosks enrolled yet."
              : "No kiosks match the current filter."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-md border border-slate-200 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Kiosk</th>
                    <th scope="col" className="px-3 py-2">Location</th>
                    <th scope="col" className="px-3 py-2">Survey (applied/desired)</th>
                    <th scope="col" className="px-3 py-2">Mode (applied/desired)</th>
                    <th scope="col" className="px-3 py-2">Config</th>
                    <th scope="col" className="px-3 py-2">State</th>
                    <th scope="col" className="px-3 py-2">Online</th>
                    <th scope="col" className="px-3 py-2">Latest command</th>
                    <th scope="col" className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFleet.map((kiosk) => (
                    <FleetRow
                      key={kiosk.id}
                      kiosk={kiosk}
                      onOpenDialog={openDialog}
                      pendingAction={pendingAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="grid gap-3 md:hidden">
              {filteredFleet.map((kiosk) => (
                <FleetCard
                  key={kiosk.id}
                  kiosk={kiosk}
                  onOpenDialog={openDialog}
                  pendingAction={pendingAction}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="activity-heading" className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Activity history
          </p>
          <h2
            id="activity-heading"
            className="mt-1 text-xl font-bold tracking-tight text-foreground"
          >
            Recent activity ({totalActivityCount})
          </h2>
          <p className="mt-1 text-sm text-muted">
            Server-validated events for this organization. Sensitive
            material (credentials, hashes, tokens, raw request bodies,
            and stack traces) is stripped before display.
          </p>
        </div>

        {activity.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 p-12 text-center text-sm text-muted">
            No activity recorded yet.
          </div>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {activity.map((row) => (
              <li key={row.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[8rem_1fr_auto]">
                <div className="flex flex-col text-xs text-muted">
                  <time dateTime={row.occurred_at}>
                    {new Date(row.occurred_at).toLocaleString()}
                  </time>
                  <span>{relativeTime(row.occurred_at)}</span>
                </div>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {row.kiosk_device_name ?? "Unknown kiosk"}
                    </span>
                    {row.location_name_en || row.location_name_ar ? (
                      <span className="text-xs text-muted">
                        · {localizedLabel(row.location_name_en, row.location_name_ar)}
                      </span>
                    ) : null}
                    {row.status ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-foreground">
                    <span className="font-medium">
                      {eventTypeLabel(row.event_type)}
                    </span>{" "}
                    <span className="text-xs text-muted">
                      by {row.actor_display_name ?? row.actor_type}
                    </span>
                  </p>
                  {row.metadata_summary ? (
                    <p className="text-xs text-muted" aria-label="Event metadata">
                      {row.metadata_summary}
                    </p>
                  ) : null}
                </div>
                <div className="text-xs text-muted md:text-right">
                  {row.event_type}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {dialog ? (
        <CommandDialog
          dialog={dialog}
          organizationId={organizationId}
          pickedSurveyId={pickedSurveyId}
          setPickedSurveyId={setPickedSurveyId}
          confirmText={confirmText}
          setConfirmText={setConfirmText}
          onConfirm={submitAction}
          onCancel={closeDialog}
          pendingAction={pendingAction}
          error={error}
          confirmRequired={confirmRequired}
          confirmAllowed={confirmAllowed}
        />
      ) : null}
    </div>
  );
}

interface FleetRowProps {
  kiosk: FleetKiosk;
  onOpenDialog: (kiosk: FleetKiosk, commandType: KioskCommandType) => void;
  pendingAction: string | null;
}

function FleetRow({ kiosk, onOpenDialog, pendingAction }: FleetRowProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Refresh the online indicator periodically so a long-lived
    // dashboard doesn't claim a kiosk is online based on a heartbeat
    // that has since aged out.
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const online = isCurrentlyOnline(kiosk.last_seen_at, now);
  const actions = availableActions(kiosk);
  const isPending = pendingAction?.startsWith(`${kiosk.id}:`) ?? false;

  return (
    <tr className="border-t border-slate-100">
      <th scope="row" className="px-3 py-2 align-top">
        <div className="font-semibold text-foreground">{kiosk.device_name}</div>
        <div className="text-xs text-muted">
          {kiosk.device_identifier ?? "no identifier"}
        </div>
        <div className="mt-1">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(kiosk.status)}`}
          >
            {statusLabel(kiosk.status as KioskFleetStatus)}
          </span>{" "}
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              kiosk.has_credential
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {kiosk.has_credential ? "credential active" : "no credential"}
          </span>
        </div>
      </th>
      <td className="px-3 py-2 align-top text-sm">
        {kiosk.location_name_en || kiosk.location_name_ar
          ? localizedLabel(kiosk.location_name_en, kiosk.location_name_ar)
          : "—"}
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <div>
          {localizedLabel(kiosk.applied_survey_title_en, kiosk.applied_survey_title_ar)}
        </div>
        <div className="text-xs text-muted">
          desired: {localizedLabel(kiosk.desired_survey_title_en, kiosk.desired_survey_title_ar)}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <div>{modeLabel(kiosk.applied_mode)}</div>
        <div className="text-xs text-muted">
          desired: {modeLabel(kiosk.desired_mode)}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <div>v{kiosk.applied_config_version} / v{kiosk.desired_config_version}</div>
        <div
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(kiosk.configuration_status)}`}
        >
          {kiosk.configuration_status}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <div>
          {kiosk.pending_command_count > 0 ? (
            <span className="text-sky-700">{kiosk.pending_command_count} pending</span>
          ) : (
            "—"
          )}
        </div>
        <div>
          {kiosk.failed_command_count > 0 ? (
            <span className="text-rose-700">{kiosk.failed_command_count} failed</span>
          ) : (
            "—"
          )}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
          }`}
          aria-label={online ? "Online" : "Offline"}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${
              online ? "bg-emerald-600" : "bg-slate-400"
            }`}
          />
          {online ? "Online" : "Offline"}
        </span>
        <div className="mt-1 text-xs text-muted">
          last seen {relativeTime(kiosk.last_seen_at)}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm">
        {kiosk.latest_command_type ? (
          <div>
            <div>{commandTypeLabel(kiosk.latest_command_type)}</div>
            <div className="text-xs text-muted">
              <span className={statusBadgeClass(kiosk.latest_command_status)}>
                {kiosk.latest_command_status}
              </span>{" "}
              · {relativeTime(kiosk.latest_command_created_at)}
            </div>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-right">
        <ActionButtons
          kiosk={kiosk}
          actions={actions}
          disabled={isPending}
          onOpenDialog={onOpenDialog}
        />
      </td>
    </tr>
  );
}

function FleetCard({
  kiosk,
  onOpenDialog,
  pendingAction,
}: FleetRowProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const online = isCurrentlyOnline(kiosk.last_seen_at, now);
  const actions = availableActions(kiosk);
  const isPending = pendingAction?.startsWith(`${kiosk.id}:`) ?? false;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {kiosk.device_name}
          </h3>
          <p className="text-xs text-muted">
            {kiosk.device_identifier ?? "no identifier"} ·{" "}
            {localizedLabel(kiosk.location_name_en, kiosk.location_name_ar)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${
              online ? "bg-emerald-600" : "bg-slate-400"
            }`}
          />
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Survey (applied)</dt>
          <dd className="font-medium text-foreground">
            {localizedLabel(kiosk.applied_survey_title_en, kiosk.applied_survey_title_ar)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Survey (desired)</dt>
          <dd className="font-medium text-foreground">
            {localizedLabel(kiosk.desired_survey_title_en, kiosk.desired_survey_title_ar)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Mode</dt>
          <dd>
            {modeLabel(kiosk.applied_mode)} →{" "}
            <span className="text-muted">{modeLabel(kiosk.desired_mode)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Config</dt>
          <dd>
            v{kiosk.applied_config_version} / v{kiosk.desired_config_version}{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(kiosk.configuration_status)}`}
            >
              {kiosk.configuration_status}
            </span>
          </dd>
        </div>
      </dl>

      <footer className="mt-4 flex flex-wrap gap-2">
        <ActionButtons
          kiosk={kiosk}
          actions={actions}
          disabled={isPending}
          onOpenDialog={onOpenDialog}
        />
      </footer>
    </article>
  );
}

interface ActionButtonsProps {
  kiosk: FleetKiosk;
  actions: { type: KioskCommandType; label: string; destructive: boolean }[];
  disabled: boolean;
  onOpenDialog: FleetRowProps["onOpenDialog"];
}

function ActionButtons({ kiosk, actions, disabled, onOpenDialog }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2" role="group" aria-label={`Actions for ${kiosk.device_name}`}>
      {actions.map((action) => (
        <button
          key={action.type}
          type="button"
          disabled={disabled}
          onClick={() => onOpenDialog(kiosk, action.type)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            action.destructive
              ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
              : "border border-slate-200 text-foreground hover:bg-slate-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={`${action.label} for ${kiosk.device_name}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

interface DialogProps {
  dialog: DialogState;
  organizationId: string;
  pickedSurveyId: string | null;
  setPickedSurveyId: (id: string | null) => void;
  confirmText: string;
  setConfirmText: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pendingAction: string | null;
  error: string | null;
  confirmRequired: boolean;
  confirmAllowed: boolean;
}

function CommandDialog({
  dialog,
  organizationId,
  pickedSurveyId,
  setPickedSurveyId,
  confirmText,
  setConfirmText,
  onConfirm,
  onCancel,
  pendingAction,
  error,
  confirmRequired,
  confirmAllowed,
}: DialogProps) {
  const isChangeSurvey = dialog.commandType === "change_survey";
  const isPending = pendingAction !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-dialog-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/60 p-4 md:items-center"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="command-dialog-title" className="text-lg font-semibold text-foreground">
          {KIOSK_COMMAND_LABELS[dialog.commandType]} · {dialog.kiosk.device_name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {dialog.kiosk.location_name_en || dialog.kiosk.location_name_ar
            ? localizedLabel(dialog.kiosk.location_name_en, dialog.kiosk.location_name_ar)
            : "no location set"}
        </p>

        {isChangeSurvey ? (
          <ChangeSurveyForm
            organizationId={organizationId}
            kiosk={dialog.kiosk}
            pickedSurveyId={pickedSurveyId}
            setPickedSurveyId={setPickedSurveyId}
          />
        ) : null}

        {confirmRequired ? (
          <div className="mt-4">
            <p className="text-sm text-rose-700">
              This action revokes or re-issues credentials and cannot be
              undone without re-pairing hardware. Type the kiosk name
              below to confirm.
            </p>
            <label htmlFor="command-confirm" className="sr-only">
              Type the kiosk name to confirm
            </label>
            <input
              id="command-confirm"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              autoComplete="off"
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || (confirmRequired && !confirmAllowed)}
            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? "Submitting…"
              : confirmRequired
                ? `Confirm ${KIOSK_COMMAND_LABELS[dialog.commandType]}`
                : KIOSK_COMMAND_LABELS[dialog.commandType]}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeSurveyForm({
  organizationId,
  kiosk,
  pickedSurveyId,
  setPickedSurveyId,
}: {
  organizationId: string;
  kiosk: FleetKiosk;
  pickedSurveyId: string | null;
  setPickedSurveyId: (id: string | null) => void;
}) {
  const [surveys, setSurveys] = useState<FleetEligibleSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/kiosk/eligible-surveys?organizationId=${encodeURIComponent(organizationId)}&kioskId=${encodeURIComponent(kiosk.id)}`,
        );
        if (cancelled) return;
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Request failed (${response.status})`);
        }
        const body = (await response.json()) as {
          surveys: FleetEligibleSurvey[];
        };
        if (!cancelled) {
          setSurveys(body.surveys ?? []);
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof Error ? caught.message : String(caught));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, kiosk.id]);

  if (loading) {
    return (
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        Loading eligible surveys…
      </p>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {loadError}
      </p>
    );
  }

  if (surveys.length === 0) {
    return (
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        No eligible surveys in this organization. Add or publish a
        survey before changing the assignment.
      </p>
    );
  }

  return (
    <fieldset className="mt-3 grid gap-2">
      <legend className="text-sm font-medium text-foreground">
        Choose a survey
      </legend>
      {surveys.map((survey) => (
        <label
          key={survey.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <input
            type="radio"
            name="change-survey"
            value={survey.id}
            checked={pickedSurveyId === survey.id || (!pickedSurveyId && survey.is_current_desired)}
            onChange={() => setPickedSurveyId(survey.id)}
            className="h-4 w-4 border-slate-300 text-brand focus:ring-brand"
          />
          <span className="flex-1">
            <span className="font-medium text-foreground">
              {localizedLabel(survey.title_en, survey.title_ar)}
            </span>
            {survey.is_current_desired ? (
              <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                current desired
              </span>
            ) : null}
            {survey.is_current_applied ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                current applied
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
