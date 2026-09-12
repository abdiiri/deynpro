/**
 * Browser-native license verification — mirrors electron/license.cjs.
 *
 * Same code format:  DPL1.<payload-base64url>.<signature-base64url>
 * Same public key, same Ed25519 signature scheme (verified here with the
 * Web Crypto API instead of Node's `crypto` module). Codes issued by the
 * license-admin tool activate both the desktop app and this web build.
 *
 * The activation code itself is stored in localStorage (instead of
 * electron-store) — it never leaves the device either way.
 *
 * Device limit: on first activation on a given device, this also checks
 * in with a small Supabase function (see license-admin/supabase/schema.sql)
 * so the same code can't be activated on unlimited devices — see
 * deviceRegistry.ts. That's one of the few network calls this file makes;
 * day-to-day use otherwise stays fully offline.
 *
 * Free trial: if no code has ever been entered on this device, it gets a
 * 7-day trial automatically, tracked by a timestamp in localStorage — no
 * code, no network call. Once the trial runs out, the normal activation
 * screen takes over.
 *
 * Remote deactivation: a lightweight periodic online check (deviceRegistry's
 * checkShopStatus) so a shop can be locked out even on an already-activated
 * device. Fails open when offline — never locks someone out just for
 * having no signal.
 */

import { getDeviceId, getDeviceLabel } from "@/lib/deviceId";
import { registerDevice, checkShopStatus } from "@/lib/deviceRegistry";
import { checkShopSnapshot, isLocalDataEmpty, pullShopSnapshot, pushShopSnapshot, optOutOfPull } from "@/lib/cloudSnapshot";

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEATqyRJOdCvdqI2tnKGC8E29tWjOF82sf8DmkYaIsv5aI=
-----END PUBLIC KEY-----
`;

const STORAGE_KEY = "deynpro_license_code";
const TRIAL_START_KEY = "deynpro_trial_start";
const TRIAL_DAYS = 7;
const DEFAULT_DEVICE_LIMIT = 2;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function b64urlToBuf(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function textToBuf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer;
}

let cachedKey: CryptoKey | null = null;
async function getPublicKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(PUBLIC_KEY_PEM),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  return cachedKey;
}

interface ParsedLicense {
  valid: boolean;
  error?: string;
  prefix?: string;
  payload?: {
    shopId: string;
    shopName?: string;
    plan?: string;
    issuedAt?: number;
    expiresAt: number;
    deviceLimit?: number;
  };
}

async function parseAndVerify(code: string): Promise<ParsedLicense> {
  if (!code || typeof code !== "string") return { valid: false, error: "No code provided." };
  const parts = code.trim().split(".");
  if (parts.length !== 3) return { valid: false, error: "This does not look like a valid code." };
  const [prefix, payloadB64, sigB64] = parts;

  let ok = false;
  try {
    const key = await getPublicKey();
    ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      b64urlToBuf(sigB64),
      textToBuf(payloadB64)
    );
  } catch {
    return { valid: false, error: "Could not read this code — please check it was copied in full." };
  }
  if (!ok) return { valid: false, error: "This code is not genuine, or has been altered." };

  let payload: any;
  try {
    const jsonText = new TextDecoder("utf-8").decode(b64urlToBuf(payloadB64));
    payload = JSON.parse(jsonText);
  } catch {
    return { valid: false, error: "Could not read this code — please check it was copied in full." };
  }

  if (prefix !== "DPL1") return { valid: false, error: "This is not a license code." };
  if (!payload.shopId || !payload.expiresAt) {
    return { valid: false, error: "This code is missing required information." };
  }
  return { valid: true, prefix, payload };
}

/** Starts (if needed) and reads the no-code free trial window for this device. */
function getTrialStatus() {
  let start = localStorage.getItem(TRIAL_START_KEY);
  if (!start) {
    start = String(Date.now());
    localStorage.setItem(TRIAL_START_KEY, start);
  }
  const startMs = Number(start);
  const expiresAt = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const trialDaysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return { startMs, expiresAt, expired: Date.now() > expiresAt, trialDaysLeft };
}

export async function getWebLicenseStatus() {
  const code = localStorage.getItem(STORAGE_KEY);

  if (!code) {
    // No code ever entered on this device — fall back to the free trial.
    const trial = getTrialStatus();
    if (!trial.expired) {
      return { activated: true, trial: true, trialDaysLeft: trial.trialDaysLeft, expiresAt: trial.expiresAt };
    }
    return { activated: false, trialExpired: true };
  }

  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return { activated: false, error: result.error };

  const { payload } = result;
  const expired = Date.now() > payload.expiresAt;

  // Remote deactivation check — online only, fails open when offline (see
  // checkShopStatus). Only worth checking for a code that's otherwise valid.
  if (!expired) {
    const { revoked } = await checkShopStatus(payload.shopId);
    if (revoked) {
      return {
        activated: false,
        revoked: true,
        shopId: payload.shopId,
        shopName: payload.shopName,
        error: "Access to this code has been turned off. Contact support if you think this is a mistake.",
      };
    }
  }

  return {
    activated: true,
    expired,
    shopId: payload.shopId,
    shopName: payload.shopName,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

export async function activateWebLicense(code: string) {
  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return { ok: false, error: result.error };

  const { payload } = result;

  if (Date.now() > payload.expiresAt) {
    return { ok: false, error: "This code has already expired — ask for a new one." };
  }

  // A shop that's been remotely deactivated shouldn't be able to activate
  // on a brand new device either, not just get caught on a recheck later.
  const { revoked } = await checkShopStatus(payload.shopId);
  if (revoked) {
    return { ok: false, error: "Access to this code has been turned off. Contact support if you think this is a mistake." };
  }

  // Device-limit check-in (see deviceRegistry.ts) — the one network call
  // in this whole file, made only here, only once per new device.
  const deviceId = getDeviceId();
  const deviceLabel = getDeviceLabel();
  const limit = payload.deviceLimit || DEFAULT_DEVICE_LIMIT;
  const deviceResult = await registerDevice(payload.shopId, deviceId, deviceLabel, limit);

  if (!deviceResult.ok) {
    if (deviceResult.error === "device_limit_reached") {
      return {
        ok: false,
        error: `This code is already active on ${deviceResult.limit ?? limit} device(s) — the maximum for this subscription. Ask support to free up a device slot.`,
        deviceLimitReached: true,
        deviceCount: deviceResult.count,
        deviceLimit: deviceResult.limit ?? limit,
      };
    }
    return { ok: false, error: "Could not verify this code right now — check your connection and try again." };
  }

  localStorage.setItem(STORAGE_KEY, code.trim());

  // Only offer to "continue with existing data" when this device is
  // genuinely fresh — never overwrite a device that already has its own
  // real data just because it happens to (re-)activate the same code.
  let snapshotAvailable: { updatedAt?: string; recordCount?: number } | undefined;
  try {
    if (await isLocalDataEmpty()) {
      const meta = await checkShopSnapshot(payload.shopId);
      if (meta?.exists) {
        snapshotAvailable = { updatedAt: meta.updatedAt, recordCount: meta.recordCount };
      }
    }
  } catch {
    // Best-effort only — a failed check just means no prompt is shown.
  }

  return { ok: true, ...(await getWebLicenseStatus()), snapshotAvailable };
}

/** Deactivates this device — clears the stored code so LicenseGate shows the
 * activation screen again. Does not delete local data or touch the cloud
 * snapshot; a device slot on Supabase stays used until an admin resets it. */
export function clearWebLicense(): { ok: true } {
  localStorage.removeItem(STORAGE_KEY);
  return { ok: true };
}

/** Metadata-only check for the current shop's cloud snapshot — used to show
 * "last synced" info in Settings without downloading the full data. */
export async function checkWebSnapshotMeta(): Promise<{ exists: boolean; updatedAt?: string; recordCount?: number } | null> {
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return null;
  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return null;
  return checkShopSnapshot(result.payload.shopId);
}

/** Pulls the current shop's cloud snapshot into this device's local database. */
export async function pullWebSnapshot(): Promise<{ ok: boolean; error?: string }> {
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return { ok: false, error: "Not activated." };
  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return { ok: false, error: "Not activated." };
  return pullShopSnapshot(result.payload.shopId);
}

/** Pushes this device's local database as the current shop's latest cloud snapshot. */
export async function pushWebSnapshot(): Promise<{ ok: boolean; error?: string }> {
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return { ok: false, error: "Not activated." };
  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return { ok: false, error: "Not activated." };
  return pushShopSnapshot(result.payload.shopId);
}

/** Called when the user picks "start fresh on this device" instead of
 * bringing in the shop's existing cloud data. This device will keep
 * contributing its own new data upward (so nothing it adds is lost), but
 * stops automatically pulling other devices' data back into itself —
 * otherwise the next background sync would quietly undo this choice. */
export function startFreshWebSnapshot(): void {
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return;
  // Signature check is unnecessary here — we just need the shopId to key
  // the opt-out flag, and an invalid/tampered code won't reach this point
  // via the normal activation flow anyway.
  const parts = code.trim().split(".");
  if (parts.length !== 3) return;
  try {
    const jsonText = new TextDecoder("utf-8").decode(b64urlToBuf(parts[1]));
    const payload = JSON.parse(jsonText);
    if (payload?.shopId) optOutOfPull(payload.shopId);
  } catch {
    // Best-effort — if this fails, the device just behaves as before (no opt-out).
  }
}
