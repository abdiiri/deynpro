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
 * deviceRegistry.ts. That's the only network call this file ever makes,
 * and only at the moment of activation; day-to-day use afterwards stays
 * fully offline, same as before.
 */

import { getDeviceId, getDeviceLabel } from "@/lib/deviceId";
import { registerDevice } from "@/lib/deviceRegistry";

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEATqyRJOdCvdqI2tnKGC8E29tWjOF82sf8DmkYaIsv5aI=
-----END PUBLIC KEY-----
`;

const STORAGE_KEY = "deynpro_license_code";
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

export async function getWebLicenseStatus() {
  const code = localStorage.getItem(STORAGE_KEY);
  if (!code) return { activated: false };

  const result = await parseAndVerify(code);
  if (!result.valid || !result.payload) return { activated: false, error: result.error };

  const { payload } = result;
  const expired = Date.now() > payload.expiresAt;

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
  return { ok: true, ...(await getWebLicenseStatus()) };
}
