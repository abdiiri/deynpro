import { useEffect, useRef } from 'react';
import { pushCloudSnapshot } from '@/lib/license';

const PUSH_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes while the app is open
const INITIAL_DELAY_MS = 15 * 1000; // small delay so it never competes with app startup

/**
 * Keeps this shop's cloud snapshot fresh in the background, so that
 * "continue with existing data" on another device always has something
 * recent to offer (see ContinueDataPrompt / lib/cloudSnapshot.ts).
 *
 * Silent and best-effort:
 *  - If Supabase isn't configured, or the device is offline, pushes just
 *    fail quietly and retry on the next interval — this never blocks or
 *    interrupts the person using the app.
 *  - Pass `enabled=false` (e.g. before the license is activated) to skip
 *    entirely; safe to call unconditionally from any component.
 */
export function useCloudSync(enabled: boolean): void {
  const pushingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const push = () => {
      if (pushingRef.current) return;
      pushingRef.current = true;
      pushCloudSnapshot()
        .catch(() => {})
        .finally(() => {
          pushingRef.current = false;
        });
    };

    const initialTimer = setTimeout(push, INITIAL_DELAY_MS);
    const interval = setInterval(push, PUSH_INTERVAL_MS);

    // Also push when the tab/app is about to go to the background or close
    // — catches the "closing up shop for the day" moment that a fixed
    // interval might otherwise just miss.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') push();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', push);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', push);
    };
  }, [enabled]);
}
