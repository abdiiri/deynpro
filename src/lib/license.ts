// Thin wrapper around window.electronLicense (desktop) or webLicense.ts
// (browser/PWA, any device). Verification always happens locally on the
// device — no network requests are ever made, in either build.
import { getWebLicenseStatus, activateWebLicense } from '@/lib/webLicense';

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
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!window.electronLicense) {
    // Not running inside Electron — verify the same DPL1 code locally in
    // the browser instead (see webLicense.ts).
    return getWebLicenseStatus();
  }
  return window.electronLicense.getStatus();
}

export async function activateLicense(code: string): Promise<{ ok: boolean; error?: string; deviceLimitReached?: boolean; deviceCount?: number; deviceLimit?: number }> {
  if (!window.electronLicense) {
    return activateWebLicense(code);
  }
  return window.electronLicense.activate(code);
}

export function daysRemaining(expiresAt?: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function whatsappSupportLink(message: string): string {
  const digits = SUPPORT_CONTACT.whatsapp.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
