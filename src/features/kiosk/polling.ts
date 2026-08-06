'use client';

import { useEffect } from 'react';
import { KioskConfiguration } from './types';

export type JourneyStatus = 'idle' | 'active';

// Polling hook for kiosk configuration
export function useKioskConfiguration(
  journeyStatus: JourneyStatus, 
  onUpdate: (config: KioskConfiguration) => void
): KioskConfiguration | null {
  useEffect(() => {
    // Only poll when idle to avoid interrupting customer journeys
    if (journeyStatus !== 'idle') return;

    const poll = async () => {
      try {
        const response = await fetch('/api/kiosk/config');
        if (response.ok) {
          const config = await response.json();
          onUpdate(config);
        }
      } catch (error) {
        console.error('Polling error', error);
      }
    };
    
    poll(); // Initial poll
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [journeyStatus, onUpdate]);
  
  return null; // Simplified return
}
