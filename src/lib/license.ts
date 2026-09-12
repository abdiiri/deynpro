// Thin wrapper around window.electronLicense (desktop) or webLicense.ts
// (browser/PWA, any device). Verification always happens locally on the
// device — no network requests are ever made, in either build.
import { getWebLicenseStatus, activateWebLicense, clearWebLicense, pullWebSnapshot, pushWebSnapshot, checkWebSnapshotMeta, startFreshWebSnapshot } from '@/lib/webLicense';

// EDIT THIS before you package the app for shops — this is what shows on
// the lock screen so they know how to reach you to renew.
export const SUPPORT_CONTACT = {
  name: 'DeynPro Support',
  whatsapp: '+254722474205', // digits only after '+', used to build a wa.me link
  phone: '+254722474205',
};

export interface LicenseStatus {
  activated: boolean;
  expired?: boolean;
  shopId?: string;
  shopName?: string;
  plan?: string;
  issuedAt?: number;
  expiresAt?: number;
  error?: string;
  deviceLimitReached?: boolean;
  deviceCount?: number;
  deviceLimit?: number;
  trial?: boolean;
  trialDaysLeft?: number;
  trialExpired?: boolean;
  revoked?: boolean;
}

/** Present on a successful activation when this is a fresh device AND the
 * shop already has data saved in the cloud from another device — the UI
 * should offer a "continue with that data?" choice before entering the app. */
export interface SnapshotAvailable {
  updatedAt?: string;
  recordCount?: number;
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!window.electronLicense) {
    // Not running inside Electron — verify the same DPL1 code locally in
    // the browser instead (see webLicense.ts).
    return getWebLicenseStatus();
  }
  return window.electronLicense.getStatus();
}

export async function activateLicense(code: string): Promise<{ ok: boolean; error?: string; deviceLimitReached?: boolean; deviceCount?: number; deviceLimit?: number; snapshotAvailable?: SnapshotAvailable }> {
  if (!window.electronLicense) {
    return activateWebLicense(code);
  }
  return window.electronLicense.activate(code);
}

/** Downloads the shop's cloud snapshot into this device's local database — call
 * after the user chooses "continue with existing data" following activation. */
export async function pullCloudSnapshot(): Promise<{ ok: boolean; error?: string }> {
  if (!window.electronLicense) {
    return pullWebSnapshot();
  }
  if (!window.electronLicense.pullSnapshot) {
    return { ok: false, error: 'This build does not support cloud data continuity yet — please update the app.' };
  }
  return window.electronLicense.pullSnapshot();
}

/** Uploads this device's local database as the shop's latest cloud snapshot —
 * called periodically in the background so other devices always have something
 * recent to continue from (see useCloudSync). */
export async function pushCloudSnapshot(): Promise<{ ok: boolean; error?: string }> {
  if (!window.electronLicense) {
    return pushWebSnapshot();
  }
  if (!window.electronLicense.pushSnapshot) {
    return { ok: false, error: 'not_supported' };
  }
  return window.electronLicense.pushSnapshot();
}

/** Call when the person picks "start fresh on this device" instead of
 * bringing in the shop's existing cloud data (see ContinueDataPrompt).
 * This device keeps contributing its own new data to the shared cloud
 * copy, but stops pulling other devices' data back into itself — so a
 * later background sync doesn't quietly undo this choice. */
export function startFreshCloudData(): void {
  if (!window.electronLicense) {
    startFreshWebSnapshot();
    return;
  }
  window.electronLicense.startFreshSnapshot?.();
}

export interface CloudSnapshotInfo {
  exists: boolean;
  updatedAt?: string;
  recordCount?: number;
}

/** Metadata-only look at the current shop's cloud snapshot (no data download) —
 * for showing "last synced" info and a manual sync control in Settings. */
export async function checkCloudSnapshot(): Promise<CloudSnapshotInfo | null> {
  if (!window.electronLicense) {
    return checkWebSnapshotMeta();
  }
  if (!window.electronLicense.checkSnapshot) {
    return null;
  }
  return window.electronLicense.checkSnapshot();
}

/** Signs this device out of the shop's license — back to the activation
 * screen, with local data left untouched. Pushes one last cloud snapshot
 * first (best-effort) so the shop's data stays current for other devices. */
export async function logout(): Promise<{ ok: true }> {
  try {
    await pushCloudSnapshot();
  } catch {
    // Offline or not configured — sign out anyway, nothing is lost locally.
  }
  if (!window.electronLicense) {
    return clearWebLicense();
  }
  return window.electronLicense.clear();
}

export function daysRemaining(expiresAt?: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function whatsappSupportLink(message: string): string {
  const digits = SUPPORT_CONTACT.whatsapp.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
