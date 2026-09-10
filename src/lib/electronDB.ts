/**
 * Renderer-side helper for the Electron offline SQLite database.
 *
 * Usage (only inside Electron):
 *   import { electronDB, isElectron } from "@/lib/electronDB";
 *   if (isElectron()) {
 *     const products = await electronDB.select("products", { user_id: "local" });
 *   }
 *
 * In the browser (PWA / dev preview), `window.electronDB` is undefined, so
 * `isElectron()` returns false and you should fall back to Supabase.
 */

export type TableName =
  | "customers"
  | "suppliers"
  | "products"
  | "sales"
  | "sale_items"
  | "expenses"
  | "expense_categories"
  | "transactions"
  | "shop_settings"
  | "stock_alerts"
  

export interface ElectronDBApi {
  select: <T = any>(table: TableName, filters?: Record<string, unknown>) => Promise<T[]>;
  insert: <T = any>(table: TableName, values: Record<string, unknown>) => Promise<T>;
  update: (
    table: TableName,
    values: Record<string, unknown>,
    filters: Record<string, unknown>
  ) => Promise<{ changes: number }>;
  remove: (
    table: TableName,
    filters: Record<string, unknown>
  ) => Promise<{ changes: number }>;
  exportAll: () => Promise<{ app: string; version: number; exportedAt: string; data: Record<string, unknown[]> }>;
  importAll: (payload: unknown) => Promise<{ ok: true }>;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronDB;
}

/** Throws in browser environments. Guard with `isElectron()` first. */
export const electronDB: ElectronDBApi = new Proxy({} as ElectronDBApi, {
  get(_t, prop: string) {
    if (!isElectron()) {
      throw new Error(
        `electronDB.${prop} called outside of Electron. Wrap calls with isElectron().`
      );
    }
    return (window as any).electronDB[prop];
  },
});