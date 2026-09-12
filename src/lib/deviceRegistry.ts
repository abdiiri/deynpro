/**
 * Calls the `register_device` Postgres function in Supabase — the only
 * thing the app talks to Supabase for. No SDK dependency; it's one RPC
 * call over plain fetch.
 *
 * Configure via env vars (see .env.example):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * If these aren't set, device-limit enforcement is skipped entirely and
 * activation falls back to local-only signature verification (so the app
 * still works out of the box before you set Supabase up).
 */

export interface RegisterDeviceResult {
  ok: boolean;
  newDevice?: boolean;
  error?: string;
  count?: number;
  limit?: number;
}

export function isDeviceRegistryConfigured(): boolean {
  return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

export async function checkShopStatus(shopId: string): Promise<{ revoked: boolean }> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    // Not configured — remote deactivation simply isn't available yet.
    return { revoked: false };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/check_shop_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_shop_id: shopId }),
    });
    if (!res.ok) return { revoked: false };
    const data = await res.json();
    return { revoked: !!data?.revoked };
  } catch {
    // Offline — fail OPEN. A shop should never get locked out just because
    // they have no signal right now; revocation only ever takes effect
    // once the device is back online and can actually confirm it.
    return { revoked: false };
  }
}

export async function registerDevice(
  shopId: string,
  deviceId: string,
  deviceLabel: string,
  limit: number
): Promise<RegisterDeviceResult> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    // Not configured — no device-limit enforcement, activation proceeds
    // on signature verification alone (same as before this feature existed).
    return { ok: true, newDevice: true };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/register_device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        p_shop_id: shopId,
        p_device_id: deviceId,
        p_device_label: deviceLabel,
        p_limit: limit,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `device_check_failed: ${res.status} ${text}`.slice(0, 200) };
    }
    return await res.json();
  } catch (err: any) {
    // Network error (offline, DNS, etc). Fail OPEN: don't lock a legitimate
    // shop out of their own paid app just because they have no signal right
    // now — this only ever ran once already for devices already registered.
    return { ok: true, newDevice: false, error: "offline_skip_check" };
  }
}
