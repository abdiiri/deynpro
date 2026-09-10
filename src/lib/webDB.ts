/**
 * Browser-native database for DeynPro (Web / PWA build).
 *
 * Mirrors electron/db.cjs exactly (same tables, same soft-delete via
 * deleted_at, same updated_at bump on every update, same stock triggers)
 * but stores data in IndexedDB instead of SQLite, so the app is fully
 * usable when opened in a normal browser / installed as a PWA — no
 * desktop app required.
 *
 * Exposed with the identical shape as window.electronDB (select / insert /
 * update / remove / exportAll / importAll) so every existing hook works
 * unchanged — see `getDB()` in `src/lib/db.ts` for how the two are chosen.
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
  | "stock_receivings"
  | "stock_receiving_items"
  | "eod_reports"
  | "product_categories";

const DB_NAME = "deynpro";
const DB_VERSION = 1;

const ALL_TABLES: TableName[] = [
  "customers", "suppliers", "products", "sales", "sale_items",
  "expenses", "expense_categories", "transactions", "shop_settings",
  "stock_alerts", "stock_receivings", "stock_receiving_items",
  "eod_reports", "product_categories",
];

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      for (const table of ALL_TABLES) {
        if (!idb.objectStoreNames.contains(table)) {
          idb.createObjectStore(table, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = async () => {
      const idb = req.result;
      await seedDefaults(idb);
      resolve(idb);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function seedDefaults(idb: IDBDatabase) {
  const seed = async (table: TableName, names: string[], extra: Record<string, unknown> = {}) => {
    const existing = await allRows(idb, table);
    if (existing.filter((r: any) => !r.deleted_at).length > 0) return;
    await Promise.all(
      names.map((name) =>
        putRow(idb, table, {
          id: uuid(),
          name,
          created_at: now(),
          updated_at: now(),
          deleted_at: null,
          ...extra,
        })
      )
    );
  };
  await seed("product_categories", ["Electronics", "Food", "Clothing", "Hardware", "Beauty", "Stationery", "Other"]);
  await seed("expense_categories", ["rent", "utilities", "salaries", "supplies", "transport", "other"], { color: "muted" });
}

function allRows(idb: IDBDatabase, table: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(table, "readonly");
    const req = tx.objectStore(table).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function putRow(idb: IDBDatabase, table: string, row: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(table, "readwrite");
    tx.objectStore(table).put(row);
    tx.oncomplete = () => resolve(row);
    tx.onerror = () => reject(tx.error);
  });
}

function deleteRow(idb: IDBDatabase, table: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(table, "readwrite");
    tx.objectStore(table).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function matchesFilters(row: any, filters?: Record<string, unknown>): boolean {
  if (!filters) return true;
  return Object.entries(filters).every(([k, v]) => row[k] === v);
}

// Stock trigger equivalents (see electron/db.cjs `deduct_stock_on_sale` /
// `add_stock_on_receive` SQL triggers).
async function applyInsertSideEffects(idb: IDBDatabase, table: TableName, row: any) {
  if (table === "sale_items") {
    const products = await allRows(idb, "products");
    const product = products.find((p) => p.id === row.product_id);
    if (product) {
      const delta =
        row.piece_mode === 1 && row.pieces_per_pack > 0
          ? Number(row.quantity) / Number(row.pieces_per_pack)
          : Number(row.quantity);
      product.quantity = Number(product.quantity || 0) - delta;
      product.updated_at = now();
      await putRow(idb, "products", product);
    }
  }
  if (table === "stock_receiving_items") {
    const products = await allRows(idb, "products");
    const product = products.find((p) => p.id === row.product_id);
    if (product) {
      product.quantity = Number(product.quantity || 0) + Number(row.quantity_received || 0);
      product.updated_at = now();
      await putRow(idb, "products", product);
    }
  }
}

function assertTable(table: string): asserts table is TableName {
  if (!ALL_TABLES.includes(table as TableName)) {
    throw new Error(`Unknown table: ${table}`);
  }
}

async function select<T = any>(table: TableName, filters?: Record<string, unknown>): Promise<T[]> {
  assertTable(table);
  const idb = await openDB();
  const rows = await allRows(idb, table);
  return rows.filter((r) => matchesFilters(r, filters)) as T[];
}

async function insert<T = any>(table: TableName, values: Record<string, unknown>): Promise<T> {
  assertTable(table);
  const idb = await openDB();
  const row = {
    created_at: now(),
    updated_at: now(),
    deleted_at: null,
    ...values,
    id: uuid(),
  };
  await putRow(idb, table, row);
  await applyInsertSideEffects(idb, table, row);
  return row as T;
}

async function update(
  table: TableName,
  values: Record<string, unknown>,
  filters: Record<string, unknown>
): Promise<{ changes: number }> {
  assertTable(table);
  const idb = await openDB();
  const rows = await allRows(idb, table);
  const targets = rows.filter((r) => matchesFilters(r, filters));
  for (const row of targets) {
    Object.assign(row, values, { updated_at: now() });
    await putRow(idb, table, row);
  }
  return { changes: targets.length };
}

async function remove(
  table: TableName,
  filters: Record<string, unknown>
): Promise<{ changes: number }> {
  assertTable(table);
  const idb = await openDB();
  const hard = (filters as any)?.__hard === true;
  const { __hard, ...rest } = (filters || {}) as Record<string, unknown>;
  const rows = await allRows(idb, table);
  const targets = rows.filter((r) => matchesFilters(r, rest));
  if (hard) {
    for (const row of targets) await deleteRow(idb, table, row.id);
  } else {
    for (const row of targets) {
      row.deleted_at = now();
      row.updated_at = now();
      await putRow(idb, table, row);
    }
  }
  return { changes: targets.length };
}

async function exportAll() {
  const idb = await openDB();
  const data: Record<string, unknown[]> = {};
  for (const table of ALL_TABLES) {
    data[table] = await allRows(idb, table);
  }
  return { app: "deynpro", version: 1, exportedAt: now(), data };
}

async function importAll(payload: any) {
  if (!payload?.data) throw new Error("Invalid backup file");
  const idb = await openDB();
  for (const table of ALL_TABLES) {
    const rows = payload.data[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && row.id) await putRow(idb, table, row);
    }
  }
  return { ok: true as const };
}

export const webDB = { select, insert, update, remove, exportAll, importAll };
