import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectIOS(): boolean {
  const ua = navigator.userAgent || "";
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "Mac" but has touch support, unlike a real Mac.
  const isIPadOS13 = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS13;
}

function detectStandalone(): boolean {
  return (
    !!window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as any).standalone === true // iOS Safari's own flag
  );
}

export interface PwaInstallState {
  /** Chrome/Edge/Android — a real native prompt is ready to fire. */
  canPrompt: boolean;
  /** Safari on iPhone/iPad — no native prompt exists; show manual steps instead. */
  isIOS: boolean;
  /** Already running as an installed app — hide the install UI entirely. */
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIOS(detectIOS());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setIsStandalone(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }, [deferredEvent]);

  return { canPrompt: !!deferredEvent, isIOS, isStandalone, promptInstall };
}
