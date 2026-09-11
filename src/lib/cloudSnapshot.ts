/**
 * Cross-device data continuity ("continue on this device?") — browser build.
 *
 * This is deliberately NOT live multi-device sync. It's a last-write-wins
 * snapshot of the shop's local database (same shape as the existing
 * exportAll()/importAll() backup feature), pushed to Supabase periodically,
 * so that when the same license activates on a *new* device, that device
 * can offer "continue with this shop's existing data" instead of starting
 * from an empty database.
 *
 * Mirrors electron/license.cjs's checkSnapshotMeta/pushSnapshot/pullSnapshot
 * for the desktop build — same RPCs, same rules (see
 * license-admin/supabase/schema.sql):
 *   - push_shop_snapshot / get_shop_snapshot_meta / get_shop_snapshot
 *   - only a device_id already registered for that shop_id (i.e. one that
 *     has activated a genuine license code for it) may push or pull.
 *
 * Uses the same public "anon" Supabase key as deviceRegistry.ts — safe to
 * ship in the client bundle, it can only call these three functions.
 */

import { getDeviceId } from "@/lib/deviceId";
import { getDB } from "@/lib/db";

export interface SnapshotMeta {
  exists: boolean;
  updatedAt?: string;
  recordCount?: number;
}

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function callRpc(fn: string, body: Record<string, unknown>): Promise<any> {
  const cfg = supabaseConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `rpc_failed_${res.status}` };
    return await res.json();
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Counts non-deleted rows across all tables in an exportAll() data object. */
function countRecords(data: Record<string, unknown[]>): number {
  return Object.values(data).reduce((sum: number, rows) => {
    if (!Array.isArray(rows)) return sum;
    return sum + rows.filter((r: any) => !r?.deleted_at).length;
  }, 0);
}

/** True if this device's local database has essentially nothing in it yet. */
export async function isLocalDataEmpty(): Promise<boolean> {
  try {
    const exported = await getDB().exportAll();
    return countRecords(exported.data) === 0;
  } catch {
    return false;
  }
}

/** Lightweight check — does the cloud have a snapshot for this shop, and when was it last updated? */
export async function checkShopSnapshot(shopId: string): Promise<SnapshotMeta | null> {
  const result = await callRpc("get_shop_snapshot_meta", {
    p_shop_id: shopId,
    p_device_id: getDeviceId(),
  });
  if (!result?.ok) return null;
  return {
    exists: !!result.exists,
    updatedAt: result.updated_at,
    recordCount: result.record_count,
  };
}

/** Downloads the shop's cloud snapshot and imports it into this device's local database. */
export async function pullShopSnapshot(shopId: string): Promise<{ ok: boolean; error?: string }> {
  const result = await callRpc("get_shop_snapshot", {
    p_shop_id: shopId,
    p_device_id: getDeviceId(),
  });
  if (!result?.ok) {
    return { ok: false, error: "Could not reach the server — check your connection and try again." };
  }
  if (!result.exists || !result.data) {
    return { ok: false, error: "No cloud data was found for this shop." };
  }
  await getDB().importAll({ data: result.data });
  return { ok: true };
}

/** Uploads this device's current local database as the shop's latest cloud snapshot. */
export async function pushShopSnapshot(shopId: string): Promise<{ ok: boolean; error?: string }> {
  const exported = await getDB().exportAll();
  const result = await callRpc("push_shop_snapshot", {
    p_shop_id: shopId,
    p_device_id: getDeviceId(),
    p_data: exported.data,
    p_record_count: countRecords(exported.data),
  });
  if (!result?.ok) {
    return { ok: false, error: result?.error === "offline" ? "offline" : "Could not sync to the cloud right now." };
  }
  return { ok: true };
}
