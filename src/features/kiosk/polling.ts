'use client';

import { useEffect } from 'react';
import { KioskConfiguration } from './types';

export type JourneyStatus = 'idle' | 'active';

/**
 * Polls /api/kiosk/config on a fixed interval while the kiosk is idle.
 * The returned configuration drives the on-screen UI (survey, mode,
 * applied vs desired, configuration_status). The polling stops the
 * instant a customer journey starts so we never tear focus away from
 * the in-flight session.
 */
export function useKioskConfiguration(
  journeyStatus: JourneyStatus,
  onUpdate: (config: KioskConfiguration) => void
): KioskConfiguration | null {
  useEffect(() => {
    if (journeyStatus !== 'idle') return;

    const poll = async () => {
      try {
        const response = await fetch('/api/kiosk/config', {
          credentials: 'include',
        });
        if (response.ok) {
          const config = (await response.json()) as KioskConfiguration;
          onUpdate(config);
        }
      } catch (error) {
        // Polling failures must never crash the device shell; the
        // kiosk keeps using the last known configuration until the
        // next successful poll.
        console.error('Kiosk configuration poll failed', error);
      }
    };

    void poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [journeyStatus, onUpdate]);

  return null;
}

export type KioskCommand = {
  commandId: string;
  commandType: string;
  commandPayload: unknown;
  desiredConfigVersion: number;
  issuedAt: string;
  expiresAt: string;
};

/**
 * Polls the device-facing command channel on the same cadence as the
 * configuration poll. The C3 RPC returns at most one pending or
 * delivered command per call, so we surface that one to the device.
 *
 * The kiosk executes the command in the background and then acks it
 * via /api/kiosk/command/[id]/ack. The poll returns null until the
 * server marks the command acknowledged, which keeps the device from
 * re-running the same command twice.
 */
export function useKioskPendingCommand(
  journeyStatus: JourneyStatus,
  onCommand: (command: KioskCommand | null) => void,
): void {
  useEffect(() => {
    if (journeyStatus !== 'idle') {
      onCommand(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch('/api/kiosk/command', {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!response.ok) {
          onCommand(null);
          return;
        }
        const body = (await response.json()) as { command?: KioskCommand };
        onCommand(body.command ?? null);
      } catch (error) {
        console.error('Kiosk command poll failed', error);
        onCommand(null);
      }
    };

    void poll();
    const interval = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [journeyStatus, onCommand]);
}
