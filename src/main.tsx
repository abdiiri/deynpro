import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker — browser/web build only. Electron loads
// via file://, which doesn't support service workers, and already has its
// own offline story (local SQLite), so it's skipped there.
if (!(window as any).electronEnv && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    // Not built with the PWA plugin active (e.g. some dev modes) — fine to skip.
  });
}
