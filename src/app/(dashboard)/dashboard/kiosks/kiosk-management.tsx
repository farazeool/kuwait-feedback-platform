"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KioskStatus } from "@/lib/kiosk/status";

// Loading state keys to prevent duplicate submissions
type LoadingAction = "create" | `update:${string}` | `archive:${string}`;

// Mirrors the flat column list returned by the list_kiosk_devices RPC. The RPC
// returns localized text as separate *_en / *_ar columns rather than nested
// JSON objects, so this shape must stay flat to match it.
export interface KioskDevice {
  id: string;
  device_name: string;
  device_identifier: string | null;
  status: KioskStatus;
  survey_id: string | null;
  survey_title_en: string | null;
  survey_title_ar: string | null;
  location_name_en: string | null;
  location_name_ar: string | null;
  last_seen_at: string | null;
  last_response_at: string | null;
  total_responses: number;
  created_at: string;
}

export interface KioskLocation {
  id: string;
  name_en: string | null;
  name_ar: string | null;
}

export interface KioskSurvey {
  id: string;
  title_en: string | null;
  title_ar: string | null;
  public_slug: string;
}

interface KioskManagementProps {
  // The create endpoint scopes the new device to this organization, so the
  // server component must pass it down; without it every POST is rejected.
  organizationId: string;
  devices: KioskDevice[];
  locations: KioskLocation[];
  surveys: KioskSurvey[];
}

/**
 * Picks the English label and falls back to Arabic when a record has only the
 * Arabic text populated, so partially translated rows still render a name.
 */
function localizedLabel(en: string | null, ar: string | null): string {
  return en ?? ar ?? "";
}

export function KioskManagement({ organizationId, devices, locations, surveys }: KioskManagementProps) {
  const router = useRouter();
  // Data arrives from the server component, so there is no client-side fetch on
  // mount. After a mutation we ask the router to re-render the server component,
  // which re-runs the queries and streams fresh rows back down as props.
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<KioskDevice | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  // Track in-flight operations to prevent duplicate submissions
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCreateDevice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Prevent duplicate submissions
    if (loadingAction === "create") return;

    // Capture the form before awaiting: React clears currentTarget once the
    // synchronous part of the event handler returns.
    const form = e.currentTarget;
    const formData = new FormData(form);
    const deviceName = formData.get("deviceName") as string;
    const locationId = formData.get("locationId") as string;
    const surveyId = (formData.get("surveyId") as string) || null;

    setActionError(null);
    setLoadingAction("create");
    try {
      const response = await fetch("/api/admin/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, deviceName, locationId, surveyId }),
      });

      if (!response.ok) {
        // Surface the API's reason instead of a generic message, otherwise a
        // validation failure is indistinguishable from a network error.
        const detail = await response
          .json()
          .then((body) => (body as { error?: string })?.error)
          .catch(() => null);
        throw new Error(detail || "Failed to create device");
      }

      form.reset();
      setShowCreateForm(false);
      refresh();
    } catch (error) {
      console.error("Failed to create device:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to create device. Please try again."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleUpdateDevice(deviceId: string, updates: {
    deviceName?: string;
    surveyId?: string | null;
    status?: string;
    notes?: string;
    changeReason?: string;
  }) {
    // Prevent duplicate submissions
    const actionKey: LoadingAction = `update:${deviceId}`;
    if (loadingAction === actionKey) return;

    setActionError(null);
    setLoadingAction(actionKey);
    try {
      const response = await fetch(`/api/admin/kiosks/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((body) => (body as { error?: string })?.error)
          .catch(() => null);
        throw new Error(detail || "Failed to update device");
      }

      setSelectedDevice(null);
      refresh();
    } catch (error) {
      console.error("Failed to update device:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to update device. Please try again."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleArchiveDevice(deviceId: string) {
    // Prevent duplicate submissions
    const actionKey: LoadingAction = `archive:${deviceId}`;
    if (loadingAction === actionKey) return;

    if (!confirm("Are you sure you want to archive this device?")) return;

    setActionError(null);
    setLoadingAction(actionKey);
    try {
      const response = await fetch(`/api/admin/kiosks/${deviceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((body) => (body as { error?: string })?.error)
          .catch(() => null);
        throw new Error(detail || "Failed to archive device");
      }

      setSelectedDevice(null);
      refresh();
    } catch (error) {
      console.error("Failed to archive device:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to archive device. Please try again."
      );
    } finally {
      setLoadingAction(null);
    }
  }

  const filteredDevices = devices.filter(device => {
    const needle = searchTerm.toLowerCase();
    const matchesSearch =
      device.device_name.toLowerCase().includes(needle) ||
      (device.device_identifier?.toLowerCase().includes(needle) ?? false);
    const matchesStatus = statusFilter === "all" || device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "paused": return "bg-yellow-100 text-yellow-800";
      case "maintenance": return "bg-orange-100 text-orange-800";
      case "offline": return "bg-gray-100 text-gray-800";
      case "archived": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="space-y-6" aria-busy={isPending}>
      {actionError && (
        <div role="alert" className="border border-red-300 bg-red-50 text-red-700 rounded-lg px-4 py-3">
          {actionError}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="search"
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-lg w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </select>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Device
        </button>
      </div>

      {/* Create form modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Register New Kiosk Device</h2>
            <form onSubmit={handleCreateDevice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Device Name *</label>
                <input
                  type="text"
                  name="deviceName"
                  required
                  placeholder="e.g., Kuwait Airport - Gate A"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location *</label>
                <select name="locationId" required className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {localizedLabel(loc.name_en, loc.name_ar)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Assign Survey (Optional)</label>
                <select name="surveyId" className="w-full px-3 py-2 border rounded-lg">
                  <option value="">None</option>
                  {surveys.map(survey => (
                    <option key={survey.id} value={survey.id}>
                      {localizedLabel(survey.title_en, survey.title_ar)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loadingAction === "create"}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAction === "create" ? "Creating..." : "Create Device"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={loadingAction === "create"}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit device modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Edit {selectedDevice.device_name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  defaultValue={selectedDevice.status}
                  onChange={(e) => handleUpdateDevice(selectedDevice.id, {
                    status: e.target.value,
                    changeReason: `Status changed to ${e.target.value}`,
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Assigned Survey</label>
                <select
                  defaultValue={selectedDevice.survey_id || ""}
                  onChange={(e) => handleUpdateDevice(selectedDevice.id, {
                    surveyId: e.target.value || null,
                    changeReason: "Survey assignment changed",
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">None</option>
                  {surveys.map(survey => (
                    <option key={survey.id} value={survey.id}>
                      {localizedLabel(survey.title_en, survey.title_ar)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => handleArchiveDevice(selectedDevice.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Devices table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Device</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Survey</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Last Seen</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Responses</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No devices found. Click &quot;Add Device&quot; to get started.
                </td>
              </tr>
            ) : (
              filteredDevices.map(device => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{device.device_name}</div>
                    {device.device_identifier && (
                      <div className="text-xs text-gray-500">{device.device_identifier}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {localizedLabel(device.location_name_en, device.location_name_ar)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {device.survey_id ? (
                      localizedLabel(device.survey_title_en, device.survey_title_ar)
                    ) : (
                      <span className="text-gray-400">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(device.status)}`}>
                      {getStatusLabel(device.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(device.last_seen_at)}</td>
                  <td className="px-4 py-3 text-sm">{device.total_responses}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Devices</div>
          <div className="text-2xl font-bold">{devices.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {devices.filter(d => d.status === "active").length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Responses</div>
          <div className="text-2xl font-bold">
            {devices.reduce((sum, d) => sum + d.total_responses, 0)}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Offline</div>
          <div className="text-2xl font-bold text-gray-600">
            {devices.filter(d => d.status === "offline").length}
          </div>
        </div>
      </div>
    </div>
  );
}
