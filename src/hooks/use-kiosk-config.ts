"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface KioskConfig {
  deviceId: string;
  surveyPublicSlug: string | null;
  status: "active" | "paused" | "maintenance" | "offline" | "archived";
  lastConfigChange: string;
}

interface UseKioskConfigOptions {
  accessToken: string | null;
  pollInterval?: number; // milliseconds, default 30000 (30s)
  onConfigChange?: (newSlug: string | null) => void;
  onStatusChange?: (newStatus: string) => void;
}

const POLL_INTERVAL = 30_000; // 30 seconds
const JITTER_MAX = 5_000; // +/- 5 seconds jitter
const HEARTBEAT_INTERVAL = 60_000; // 60 seconds
const MAX_BACKOFF = 300_000; // 5 minutes max backoff

export function useKioskConfig({
  accessToken,
  pollInterval = POLL_INTERVAL,
  onConfigChange,
  onStatusChange,
}: UseKioskConfigOptions) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const configPollTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const backoffMultiplierRef = useRef(1);
  const lastConfigChangeRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Add jitter to prevent synchronized requests from multiple kiosks
  const addJitter = (baseInterval: number) => {
    const jitter = Math.random() * JITTER_MAX * 2 - JITTER_MAX;
    return baseInterval + jitter;
  };

  // Get device info for heartbeat
  const getDeviceInfo = useCallback(() => {
    const ua = navigator.userAgent;
    let model = "Unknown";
    let os = "Unknown";
    
    // Basic device detection
    if (/iPad/.test(ua)) {
      model = "iPad";
      const match = ua.match(/OS (\d+_\d+)/);
      if (match) os = `iOS ${match[1].replace("_", ".")}`;
    } else if (/iPhone/.test(ua)) {
      model = "iPhone";
      const match = ua.match(/OS (\d+_\d+)/);
      if (match) os = `iOS ${match[1].replace("_", ".")}`;
    } else if (/Android/.test(ua)) {
      model = "Android Device";
      const match = ua.match(/Android ([\d.]+)/);
      if (match) os = `Android ${match[1]}`;
    }

    return { model, os, appVersion: "1.0.0" };
  }, []);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`/api/kiosk/config?token=${encodeURIComponent(accessToken)}`);
      
      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const data: KioskConfig = await response.json();
      
      // Check if config changed
      if (lastConfigChangeRef.current !== data.lastConfigChange) {
        if (lastConfigChangeRef.current !== null) {
          // Config changed, trigger callback
          onConfigChange?.(data.surveyPublicSlug);
        }
        lastConfigChangeRef.current = data.lastConfigChange;
      }

      // Check if status changed
      if (lastStatusRef.current !== data.status) {
        if (lastStatusRef.current !== null) {
          onStatusChange?.(data.status);
        }
        lastStatusRef.current = data.status;
      }

      setConfig(data);
      setError(null);
      
      // Reset backoff on success
      backoffMultiplierRef.current = 1;
    } catch (err) {
      console.error("Failed to fetch kiosk config:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch config");
      
      // Increase backoff on error
      backoffMultiplierRef.current = Math.min(backoffMultiplierRef.current * 2, MAX_BACKOFF / pollInterval);
    }
  }, [accessToken, pollInterval, onConfigChange, onStatusChange]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!accessToken) return;

    try {
      const deviceInfo = getDeviceInfo();
      await fetch("/api/kiosk/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken, deviceInfo }),
      });
    } catch (err) {
      console.error("Failed to send heartbeat:", err);
    }
  }, [accessToken, getDeviceInfo]);

  // Setup polling
  useEffect(() => {
    if (!accessToken) {
      return;
    }

    // Fetch immediately on mount - defer with queueMicrotask to avoid
    // synchronous setState in effect body (triggers cascading renders)
    queueMicrotask(() => fetchConfig());

    // Setup config polling with exponential backoff and jitter
    const scheduleNextPoll = () => {
      const interval = addJitter(pollInterval * backoffMultiplierRef.current);
      configPollTimerRef.current = window.setTimeout(() => {
        fetchConfig();
        scheduleNextPoll();
      }, interval);
    };

    scheduleNextPoll();

    // Setup heartbeat
    const scheduleHeartbeat = () => {
      heartbeatTimerRef.current = window.setTimeout(() => {
        sendHeartbeat();
        scheduleHeartbeat();
      }, HEARTBEAT_INTERVAL);
    };

    scheduleHeartbeat();

    // Cleanup
    return () => {
      if (configPollTimerRef.current) window.clearTimeout(configPollTimerRef.current);
      if (heartbeatTimerRef.current) window.clearTimeout(heartbeatTimerRef.current);
    };
  }, [accessToken, pollInterval, fetchConfig, sendHeartbeat]);

  // Refetch on visibility change (tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && accessToken) {
        fetchConfig();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchConfig, accessToken]);

  // Refetch on online event
  useEffect(() => {
    const handleOnline = () => {
      if (accessToken) {
        backoffMultiplierRef.current = 1; // Reset backoff
        fetchConfig();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchConfig, accessToken]);

  // isLoading is derived: true until we have a config or an error without a pending fetch
  // Once config is set, we're no longer loading. Error state doesn't clear loading since
  // polling continues with backoff.
  return {
    config,
    error,
    isLoading: config === null,
    refetch: fetchConfig,
  };
}
