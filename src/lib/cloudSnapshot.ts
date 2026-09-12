/**
 * Cross-device data continuity — browser build.
 *
 * NOT live sync (no realtime connection) — instead, every push/pull is a
 * full reconcile: fetch the cloud's current data, merge it with this
 * device's local data record-by-record (keeping whichever side has the
 * newer `updated_at` per row, and never dropping a record that only
 * exists on one side), then save the merged result both back to this
 * device and up to the cloud.
 *
 * This is what makes it safe with any number of devices actively used at
 * once (2, 5, 10...): every device just periodically reconciles with one
 * shared cloud copy, so nobody's sync can silently erase what another
 * device added — the old design (replace the whole snapshot with
 * whichever device pushed last) could do exactly that with more than one
 * active device, which is what this replaces.
 *
 * Mirrors electron/license.cjs's equivalent for the desktop build — same
 * RPCs, same rules (see license-admin/supabase/schema.sql):
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
  return Object.values(data || {}).reduce((sum: number, rows) => {
    if (!Array.isArray(rows)) return sum;
    return sum + rows.filter((r: any) => !r?.deleted_at).length;
  }, 0);
}

function rowTimestamp(row: any): number {
  const t = row?.updated_at || row?.created_at;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Merges two exportAll()-shaped data objects, table by table, record by
 * record: a record present on only one side is always kept; a record
 * present on both sides keeps whichever has the newer updated_at (ties go
 * to the local copy). Nothing is ever dropped just because one side's
 * blob didn't happen to include it — that's what makes this safe to run
 * repeatedly from any number of devices.
 */
export function mergeSnapshotData(
  localData: Record<string, any[]> | undefined,
  remoteData: Record<string, any[]> | undefined
): Record<string, any[]> {
  const tables = new Set([
    ...Object.keys(localData || {}),
    ...Object.keys(remoteData || {}),
  ]);
  const merged: Record<string, any[]> = {};

  for (const table of tables) {
    const localRows = Array.isArray(localData?.[table]) ? localData![table] : [];
    const remoteRows = Array.isArray(remoteData?.[table]) ? remoteData![table] : [];

    const byId = new Map<string, any>();
    for (const row of remoteRows) {
      if (row && row.id != null) byId.set(row.id, row);
    }
    for (const row of localRows) {
      if (!row || row.id == null) continue;
      const existing = byId.get(row.id);
      if (!existing || rowTimestamp(row) >= rowTimestamp(existing)) {
        byId.set(row.id, row);
      }
    }
    merged[table] = Array.from(byId.values());
  }

  return merged;
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

// ── "Start fresh" opt-out ───────────────────────────────────────────────
// If someone explicitly chooses "start fresh on this device" (see
// ContinueDataPrompt), this device should keep contributing its new data
// upward (so it's not lost / it still helps other devices), but should
// stop automatically pulling other devices' older data back into itself
// — otherwise the next periodic background sync would quietly undo their
// choice. This flag is per shop, per device (localStorage), and only
// affects whether reconcile() imports the merged result back locally.

function optOutKey(shopId: string): string {
  return `deynpro_no_pull_${shopId}`;
}

export function optOutOfPull(shopId: string): void {
  localStorage.setItem(optOutKey(shopId), "1");
}

export function hasOptedOutOfPull(shopId: string): boolean {
  return localStorage.getItem(optOutKey(shopId)) === "1";
}

/**
 * The one real operation: fetch the cloud snapshot, merge with local data,
 * push the merged result up, and (unless this device opted out — see
 * above) bring this device's local database up to the merged state too.
 */
async function reconcile(shopId: string, opts: { skipLocalImport?: boolean } = {}): Promise<{ ok: boolean; error?: string; recordCount?: number }> {
  const deviceId = getDeviceId();

  const remoteResult = await callRpc("get_shop_snapshot", { p_shop_id: shopId, p_device_id: deviceId });
  if (!remoteResult?.ok) {
    return { ok: false, error: remoteResult?.error === "offline" ? "offline" : (remoteResult?.error || "Could not reach the server — check your connection and try again.") };
  }
  const remoteData = remoteResult.exists ? remoteResult.data : {};

  const exported = await getDB().exportAll();
  const merged = mergeSnapshotData(exported.data, remoteData);
  const recordCount = countRecords(merged);

  const pushResult = await callRpc("push_shop_snapshot", {
    p_shop_id: shopId,
    p_device_id: deviceId,
    p_data: merged,
    p_record_count: recordCount,
  });
  if (!pushResult?.ok) {
    return { ok: false, error: pushResult?.error === "offline" ? "offline" : "Could not sync to the cloud right now." };
  }

  if (!opts.skipLocalImport) {
    await getDB().importAll({ data: merged });
  }

  return { ok: true, recordCount };
}

/** Called right after activation when the user picks "continue with this
 * shop's existing data" — always imports, since this device is fresh. */
export async function pullShopSnapshot(shopId: string): Promise<{ ok: boolean; error?: string }> {
  return reconcile(shopId, { skipLocalImport: false });
}

/** Called periodically in the background (useCloudSync) and by the manual
 * "Sync now" button — a full two-way reconcile, respecting this device's
 * "start fresh" opt-out if it set one. */
export async function pushShopSnapshot(shopId: string): Promise<{ ok: boolean; error?: string }> {
  return reconcile(shopId, { skipLocalImport: hasOptedOutOfPull(shopId) });
}
