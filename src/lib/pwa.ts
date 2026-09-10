type UpdateHandler = (reloadFn: () => void) => void;

const isInIframe = (() => {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app"));

/**
 * Registers the PWA service worker in production only.
 * Safely no-ops (and unregisters stale SWs) inside the Lovable editor preview
 * or any iframe context to avoid stale-cache and routing issues.
 */
export async function registerServiceWorker(onUpdateAvailable?: UpdateHandler) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewHost || isInIframe || import.meta.env.DEV) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js");

    wb.addEventListener("waiting", () => {
      onUpdateAvailable?.(() => {
        wb.addEventListener("controlling", () => window.location.reload());
        wb.messageSkipWaiting();
      });
    });

    await wb.register();
  } catch (err) {
    console.warn("SW registration failed:", err);
  }
}