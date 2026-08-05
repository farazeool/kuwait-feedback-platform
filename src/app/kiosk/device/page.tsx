import { getKioskDeviceState } from "@/features/kiosk/device-server";
import { KioskDeviceShell } from "./kiosk-device-shell";
import { KioskRevokedScreen, KioskNoSurveyScreen } from "@/components/kiosk/kiosk-status-screens";
import Link from "next/link";

export default async function KioskDevicePage() {
  const state = await getKioskDeviceState();

  // No valid credential - enrollment is required.
  if (!state) {
    return (
      <main className="fixed inset-0 grid place-items-center bg-black px-5">
        <section className="max-w-md rounded-3xl border border-white/20 bg-white/5 p-8 text-center text-white">
          <h1 className="text-2xl font-bold">Set up device</h1>
          <p className="mt-3 text-white/70">
            This device has not been set up. Ask an administrator for a setup QR code.
          </p>
          <Link
            href="/kiosk/setup"
            className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-black"
          >
            Set up device
          </Link>
        </section>
      </main>
    );
  }

  // Revoked status is handled by returning null from getKioskDeviceState
  // But check again for safety
  if (state.device.status === "revoked") {
    return <KioskRevokedScreen />;
  }

  // Paused status
  if (state.device.status === "paused") {
    return (
      <KioskDeviceShell
        state={state}
        mode="paused"
      />
    );
  }

  // Maintenance status
  if (state.device.status === "maintenance") {
    return (
      <KioskDeviceShell
        state={state}
        mode="maintenance"
      />
    );
  }

  // No survey assigned
  if (!state.survey) {
    return <KioskNoSurveyScreen organizationName={state.organization.name} />;
  }

  // Active with survey - render the full kiosk experience
  return (
    <KioskDeviceShell
      state={state}
      mode="active"
    />
  );
}