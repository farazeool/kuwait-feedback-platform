
import { KioskConfiguration, KioskMode } from "./types";
import { useEffect, useRef, useState } from "react";

const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

export type JourneyStatus = "idle" | "active" | "submitting" | "thank-you" | "resetting";

async function fetchConfig(): Promise<KioskConfiguration> {
  const res = await fetch("/api/kiosk/config");
  if (!res.ok) {
    throw new Error("Failed to fetch kiosk configuration");
  }
  return res.json();
}

async function acknowledgeSuccess(configVersion: number) {
  await fetch("/api/kiosk/config/success", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configVersion }),
  });
}

async function reportFailure(
  configVersion: number,
  errorCode: string,
  errorMessage: string
) {
  await fetch("/api/kiosk/config/failure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ configVersion, errorCode, errorMessage }),
  });
}

export function useKioskConfiguration(
  journeyStatus: JourneyStatus,
  onUpdate: (config: KioskConfiguration) => void
) {
  const [config, setConfig] = useState<KioskConfiguration | null>(null);
  const [pendingConfig, setPendingConfig] = useState<KioskConfiguration | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const backoffDelay = useRef(POLLING_INTERVAL_MS);

  const applyConfig = async (newConfig: KioskConfiguration) => {
    try {
      console.log("Applying config version", newConfig.desiredConfigVersion);
      onUpdate(newConfig);
      await acknowledgeSuccess(newConfig.desiredConfigVersion);
      setConfig(newConfig);
      setPendingConfig(null);
    } catch (error: unknown) {
      console.error("Failed to apply configuration:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      await reportFailure(
        newConfig.desiredConfigVersion,
        "APPLICATION_FAILED",
        message
      );
    }
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const newConfig = await fetchConfig();
        if (newConfig.desiredConfigVersion > (config?.appliedConfigVersion || 0)) {
          if (journeyStatus === "idle") {
            await applyConfig(newConfig);
          } else {
            setPendingConfig(newConfig);
          }
        }
        backoffDelay.current = POLLING_INTERVAL_MS;
      } catch (error) {
        console.error("Polling failed, backing off:", error);
        backoffDelay.current = Math.min(
          backoffDelay.current * 2,
          MAX_BACKOFF_MS
        );
      } finally {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = setTimeout(poll, backoffDelay.current);
      }
    };

    poll();
    return () => clearTimeout(pollingIntervalRef.current);
  }, [config, journeyStatus]);

  useEffect(() => {
    if (pendingConfig && journeyStatus === "idle") {
      applyConfig(pendingConfig);
    }
  }, [journeyStatus, pendingConfig]);

  return config;
}
