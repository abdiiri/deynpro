/**
 * Lets license-admin see how many devices are currently on the 7-day
 * free trial — no shop code entered, so no shop name/contact info exists
 * yet. Just a random per-device id, a rough device label, and
 * timestamps. Best-effort only: if this fails or there's no signal, the
 * trial itself is completely unaffected — this is purely for visibility,
 * never gates anything.
 */

const LAST_PING_KEY = "deynpro_trial_last_ping";
const PING_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day is plenty

export async function registerTrialDevice(deviceId: string, deviceLabel: string, trialExpiresAt: number, force = false): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return; // not configured — trial just isn't visible to admin, nothing else changes

  if (!force) {
    const lastPing = Number(localStorage.getItem(LAST_PING_KEY) || 0);
    if (Date.now() - lastPing < PING_INTERVAL_MS) return;
  }

  try {
    await fetch(`${url}/rest/v1/rpc/register_trial_device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        p_device_id: deviceId,
        p_device_label: deviceLabel,
        p_trial_expires_at: new Date(trialExpiresAt).toISOString(),
      }),
    });
    localStorage.setItem(LAST_PING_KEY, String(Date.now()));
  } catch {
    // Offline or unreachable — just try again next time. Never blocks the trial.
  }
}
