/**
 * Offline SQLite database for DeynPro (Electron).
 * No login, no users, no cloud — fully local single-user app.
 *
 * Storage: <userData>/deynpro.db
 * Engine:  better-sqlite3
 */
const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const fs = require('fs');

let db;

function init() {
  const dbPath = path.join(app.getPath('userData'), 'deynpro.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  try {
    migrate();
  } catch (err) {
    console.error('Migration failed, rebuilding DB...', err.message);
    db.close();
    try { fs.unlinkSync(dbPath); } catch (_) {}
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate();
  }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);

    CREATE TABLE IF NOT EXISTS suppliers (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      address     TEXT,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      price               REAL NOT NULL DEFAULT 0,
      cost_price          REAL NOT NULL DEFAULT 0,
      quantity            REAL NOT NULL DEFAULT 0,
      category            TEXT,
      description         TEXT,
      image_url           TEXT,
      barcode             TEXT,
      expiry_date         TEXT,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      supplier_id         TEXT,
      unit                TEXT NOT NULL DEFAULT 'pcs',
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

    CREATE TABLE IF NOT EXISTS sales (
      id             TEXT PRIMARY KEY,
      customer_id    TEXT,
      total_amount   REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      date           TEXT NOT NULL DEFAULT (datetime('now')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);

    CREATE TABLE IF NOT EXISTS sale_items (
      id              TEXT PRIMARY KEY,
      sale_id         TEXT NOT NULL,
      product_id      TEXT NOT NULL,
      quantity        REAL NOT NULL DEFAULT 1,
      unit_price      REAL NOT NULL,
      subtotal        REAL NOT NULL,
      piece_mode      INTEGER NOT NULL DEFAULT 0,
      pieces_per_pack REAL NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

    CREATE TABLE IF NOT EXISTS expenses (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      amount      REAL NOT NULL DEFAULT 0,
      category    TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      supplier_id TEXT,
      date        TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

    CREATE TABLE IF NOT EXISTS expense_categories (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT DEFAULT 'muted',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type        TEXT NOT NULL,
      amount      REAL NOT NULL,
      description TEXT,
      date        TEXT NOT NULL DEFAULT (datetime('now')),
      due_date    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_id);

    CREATE TABLE IF NOT EXISTS shop_settings (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL UNIQUE,
      shop_name  TEXT NOT NULL DEFAULT '',
      phone      TEXT,
      address    TEXT,
      logo_url   TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_alerts (
      id         TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      alert_type TEXT NOT NULL DEFAULT 'low_stock',
      message    TEXT NOT NULL,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  // ── Stock Receiving (Purchase Orders) ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_receivings (
      id            TEXT PRIMARY KEY,
      supplier_id   TEXT,
      notes         TEXT,
      total_cost    REAL NOT NULL DEFAULT 0,
      date          TEXT NOT NULL DEFAULT (datetime('now')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_stock_receivings_date ON stock_receivings(date);

    CREATE TABLE IF NOT EXISTS stock_receiving_items (
      id                  TEXT PRIMARY KEY,
      stock_receiving_id  TEXT NOT NULL,
      product_id          TEXT NOT NULL,
      quantity_received   INTEGER NOT NULL DEFAULT 0,
      cost_per_unit       REAL NOT NULL DEFAULT 0,
      subtotal            REAL NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sri_receiving ON stock_receiving_items(stock_receiving_id);

    CREATE TABLE IF NOT EXISTS eod_reports (
      id                  TEXT PRIMARY KEY,
      report_date         TEXT NOT NULL,
      cash_sales          REAL NOT NULL DEFAULT 0,
      mpesa_sales         REAL NOT NULL DEFAULT 0,
      card_sales          REAL NOT NULL DEFAULT 0,
      credit_sales        REAL NOT NULL DEFAULT 0,
      total_sales         REAL NOT NULL DEFAULT 0,
      total_cost          REAL NOT NULL DEFAULT 0,
      gross_profit        REAL NOT NULL DEFAULT 0,
      total_expenses      REAL NOT NULL DEFAULT 0,
      net_profit          REAL NOT NULL DEFAULT 0,
      opening_float       REAL NOT NULL DEFAULT 0,
      closing_float       REAL NOT NULL DEFAULT 0,
      notes               TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at          TEXT
    );
  `);

  // Trigger: add stock when a receiving item is inserted
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS add_stock_on_receive
    AFTER INSERT ON stock_receiving_items
    BEGIN
      UPDATE products SET quantity = quantity + NEW.quantity_received WHERE id = NEW.product_id;
    END;
  `);

  // Product categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  // Seed default product categories if table is empty
  const existingProdCats = db.prepare('SELECT COUNT(*) as cnt FROM product_categories WHERE deleted_at IS NULL').get();
  if (existingProdCats.cnt === 0) {
    const defaultProdCats = ['Electronics', 'Food', 'Clothing', 'Hardware', 'Beauty', 'Stationery', 'Other'];
    for (const name of defaultProdCats) {
      db.prepare('INSERT OR IGNORE INTO product_categories (id, name) VALUES (?, ?)').run(randomUUID(), name);
    }
  }

  // Seed default expense categories if none exist
  const existingExpCats = db.prepare('SELECT COUNT(*) as cnt FROM expense_categories WHERE deleted_at IS NULL').get();
  if (existingExpCats.cnt === 0) {
    const defaultExpCats = ['rent', 'utilities', 'salaries', 'supplies', 'transport', 'other'];
    for (const name of defaultExpCats) {
      db.prepare("INSERT OR IGNORE INTO expense_categories (id, name, color) VALUES (?, ?, 'muted')").run(randomUUID(), name);
    }
  }

  // Backfill columns for databases created by older versions
  const addCol = (table, col, type) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (_) {}
  };
  for (const t of ['customers','suppliers','products','sales','sale_items','expenses','expense_categories','transactions','stock_alerts','shop_settings','product_categories']) {
    addCol(t, 'updated_at', `TEXT NOT NULL DEFAULT (datetime('now'))`);
    addCol(t, 'deleted_at', 'TEXT');
  }

  // Pack / piece pricing fields on products
  // pack_name     – label for the bulk unit, e.g. "Carton", "Dozen", "Box"
  // pieces_per_pack – how many individual pieces make one pack (0 or NULL = feature disabled)
  // piece_price   – selling price for a single piece (auto-derived but can be overridden)
  addCol('products', 'pack_name',       'TEXT');
  addCol('products', 'pieces_per_pack', 'INTEGER NOT NULL DEFAULT 0');
  addCol('products', 'piece_price',     'REAL NOT NULL DEFAULT 0');

  // Unit of measure for the base quantity, e.g. "pcs", "kg", "l" — purely descriptive/display
  addCol('products', 'unit', `TEXT NOT NULL DEFAULT 'pcs'`);

  // Customer credit limits and loyalty points
  addCol('customers', 'credit_limit',   'REAL NOT NULL DEFAULT 0');
  addCol('customers', 'loyalty_points', 'INTEGER NOT NULL DEFAULT 0');
  addCol('sale_items', 'piece_mode',      'INTEGER NOT NULL DEFAULT 0');
  addCol('sale_items', 'pieces_per_pack', 'REAL NOT NULL DEFAULT 0');

  // Trigger: deduct stock when a sale item is inserted
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS deduct_stock_on_sale
    AFTER INSERT ON sale_items
    BEGIN
      UPDATE products
      SET quantity = quantity - CASE
        WHEN NEW.piece_mode = 1 AND NEW.pieces_per_pack > 0
          THEN CAST(NEW.quantity AS REAL) / NEW.pieces_per_pack
        ELSE NEW.quantity
      END
      WHERE id = NEW.product_id;
    END;
  `);

  // Triggers: auto-update updated_at on every row update
  for (const t of ['customers','suppliers','products','sales','sale_items','expenses','expense_categories','transactions','stock_alerts','shop_settings']) {
    try {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS set_updated_at_${t}
        AFTER UPDATE ON ${t} FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at
        BEGIN
          UPDATE ${t} SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
      `);
    } catch (_) {}
  }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

const ALLOWED_TABLES = new Set([
  'customers', 'suppliers', 'products', 'sales', 'sale_items',
  'expenses', 'expense_categories', 'transactions', 'shop_settings', 'stock_alerts',
  'stock_receivings', 'stock_receiving_items', 'eod_reports', 'product_categories',
]);

function assertTable(table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
}

function buildWhere(filters) {
  if (!filters || Object.keys(filters).length === 0) return { sql: '', params: [] };
  const keys = Object.keys(filters);
  return {
    sql: ' WHERE ' + keys.map(k => `${k} = ?`).join(' AND '),
    params: keys.map(k => filters[k]),
  };
}

function select(table, filters) {
  assertTable(table);
  const { sql, params } = buildWhere(filters);
  return db.prepare(`SELECT * FROM ${table}${sql}`).all(...params);
}

function insert(table, values) {
  assertTable(table);
  const row = { id: randomUUID(), ...values };
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => row[c]));
  return row;
}

function update(table, values, filters) {
  assertTable(table);
  const setKeys = Object.keys(values);
  if (setKeys.length === 0) return { changes: 0 };
  const setSql = setKeys.map(k => `${k} = ?`).join(', ');
  const { sql: whereSql, params: whereParams } = buildWhere(filters);
  const info = db.prepare(`UPDATE ${table} SET ${setSql}${whereSql}`)
    .run(...setKeys.map(k => values[k]), ...whereParams);
  return { changes: info.changes };
}

function remove(table, filters) {
  assertTable(table);
  // __hard: true → permanent delete; default → soft delete via deleted_at
  const hard = filters?.__hard === true;
  const { __hard, ...rest } = filters || {};
  const { sql, params } = buildWhere(rest);
  if (hard) {
    return { changes: db.prepare(`DELETE FROM ${table}${sql}`).run(...params).changes };
  }
  const now = new Date().toISOString();
  return {
    changes: db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ?${sql}`)
      .run(now, now, ...params).changes,
  };
}

function exportAll() {
  const data = {};
  for (const t of ALLOWED_TABLES) {
    data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  return { app: 'deynpro', version: 1, exportedAt: new Date().toISOString(), data };
}

function importAll(payload) {
  if (!payload?.data) throw new Error('Invalid backup file');
  db.transaction(() => {
    for (const t of ALLOWED_TABLES) {
      const rows = payload.data[t];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        db.prepare(
          `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...cols.map(c => row[c]));
      }
    }
  })();
  return { ok: true };
}

// ── selectSince: returns rows updated after a given ISO timestamp ─────────────
function selectSince(table, since) {
  assertTable(table);
  return db.prepare(
    `SELECT * FROM ${table} WHERE updated_at > ? ORDER BY updated_at ASC`
  ).all(since);
}

// ── Raw query helpers (used by syncEngine internally) ─────────────────────────
// These are NOT exposed over IPC — only used server-side in the main process.
function rawExec(sql, params = []) {
  if (params.length) {
    db.prepare(sql).run(...params);
  } else {
    db.exec(sql);
  }
}

function rawGet(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function rawAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** Returns the raw better-sqlite3 Database instance (for modules that need exec/prepare directly) */
function getDb() { return db; }

module.exports = { init, getDb, select, selectSince, insert, update, remove, exportAll, importAll, rawExec, rawGet, rawAll };
