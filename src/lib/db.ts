/**
 * Single entry point every hook uses to reach the database.
 *
 * - Inside the Electron desktop app: window.electronDB (SQLite via IPC).
 * - In a normal browser tab / installed PWA, on any device: the IndexedDB
 *   implementation in `webDB.ts`, so the app works fully online without
 *   the desktop app.
 *
 * Both implementations share the exact same shape (select/insert/update/remove),
 * so this is a drop-in replacement for the old `(window as any).electronDB`.
 */
import { webDB } from "@/lib/webDB";

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronDB;
}

export function getDB() {
  if (isElectron()) return (window as any).electronDB;
  return webDB;
}
