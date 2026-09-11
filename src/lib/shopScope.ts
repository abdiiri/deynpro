/**
 * Resolves which shop's local data this browser should use — purely for
 * NAMING which IndexedDB database to open (see webDB.ts), not a security
 * boundary. Deliberately skips signature verification here (that already
 * happens in webLicense.ts's parseAndVerify for anything privilege-sensitive
 * — device registration, cloud snapshot push/pull). Worst case if this ever
 * reads a bogus shopId is that the browser opens an oddly-named empty
 * database; it can't grant access to another shop's real data.
 *
 * Mirrors electron/db.cjs's per-shop `deynpro-<shopId>.db` file naming.
 */

const STORAGE_KEY = "deynpro_license_code"; // must match webLicense.ts

function b64urlToStr(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

/** The shopId embedded in whatever license code is currently stored, or
 * null if there isn't one / it can't be read. */
export function getActiveShopId(): string | null {
  try {
    const code = localStorage.getItem(STORAGE_KEY);
    if (!code) return null;
    const parts = code.trim().split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(b64urlToStr(parts[1]));
    return typeof payload?.shopId === "string" && payload.shopId ? payload.shopId : null;
  } catch {
    return null;
  }
}

function slugifyShopId(shopId: string): string {
  return shopId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

/** Per-shop IndexedDB name — a fresh device with no activated shop yet
 * falls back to `defaultName` (never reached for real data in practice,
 * since LicenseGate blocks every data screen until a shop is activated). */
export function getScopedDbName(defaultName: string): string {
  const shopId = getActiveShopId();
  return shopId ? `${defaultName}-${slugifyShopId(shopId)}` : defaultName;
}
