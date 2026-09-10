/**
 * A per-device identifier for license device-limit enforcement.
 *
 * Browsers have no stable hardware ID, so this generates a random UUID
 * the first time the app runs and keeps it in localStorage. It survives
 * restarts and browser updates, but a fresh one is created if the user
 * clears site data, uses a different browser, or uses private/incognito
 * mode — those look like "new devices" to the device-limit check.
 */

const DEVICE_ID_KEY = "deynpro_device_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Best-effort human-readable label, e.g. "Chrome on Windows" — for the admin panel only, never used for enforcement. */
export function getDeviceLabel(): string {
  const ua = navigator.userAgent || "";
  const platform =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "Mac" :
    /Linux/.test(ua) ? "Linux" : "Unknown";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${platform}`;
}
