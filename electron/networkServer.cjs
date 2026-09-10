/**
 * networkServer.cjs
 *
 * Lightweight Express HTTP API server that runs on the SERVER PC.
 * Other PCs (clients) call this over the local LAN cable network.
 *
 * Endpoints mirror the existing IPC handlers exactly so the
 * renderer-side db abstraction can call either local IPC or this API
 * with the same interface.
 *
 * Routes:
 *   GET    /api/ping                          — health check
 *   GET    /api/info                          — server info
 *   POST   /api/select/:table                 — db.select
 *   POST   /api/insert/:table                 — db.insert
 *   POST   /api/update/:table                 — db.update
 *   POST   /api/delete/:table                 — db.remove
 *   GET    /api/export                        — db.exportAll
 *   POST   /api/import                        — db.importAll
 *   POST   /api/sync/push                     — bulk push from client queue
 *   GET    /api/sync/changes/:since           — pull changes since timestamp
 */

let server = null;

function start(db, port) {
  // Lazy-require express so it only loads when server mode is active
  let express;
  try {
    express = require('express');
  } catch (_) {
    console.error('[NetworkServer] express not installed — run: npm install express');
    return null;
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // ── CORS (allow all LAN origins) ──────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Client-Id');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString(), role: 'server' });
  });

  app.get('/api/info', (_req, res) => {
    res.json({
      app: 'DeynPro',
      role: 'server',
      version: 1,
      ts: new Date().toISOString(),
    });
  });

  // ── DB operations ─────────────────────────────────────────────────────────
  app.post('/api/select/:table', (req, res) => {
    try {
      const rows = db.select(req.params.table, req.body?.filters || {});
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/insert/:table', (req, res) => {
    try {
      const row = db.insert(req.params.table, req.body?.values || {});
      res.json({ ok: true, data: row });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/update/:table', (req, res) => {
    try {
      const result = db.update(req.params.table, req.body?.values || {}, req.body?.filters || {});
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/delete/:table', (req, res) => {
    try {
      const result = db.remove(req.params.table, req.body?.filters || {});
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/export', (_req, res) => {
    try {
      const data = db.exportAll();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/import', (req, res) => {
    try {
      const result = db.importAll(req.body?.payload);
      res.json({ ok: true, data: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ── Sync: client pushes its queued operations ─────────────────────────────
  // Body: { clientId, operations: [{ id, operation, table_name, payload }] }
  app.post('/api/sync/push', (req, res) => {
    const { clientId, operations } = req.body || {};
    if (!Array.isArray(operations)) {
      return res.status(400).json({ ok: false, error: 'operations must be an array' });
    }

    const results = [];
    for (const op of operations) {
      try {
        const { operation, table_name, payload } = op;
        const p = typeof payload === 'string' ? JSON.parse(payload) : payload;

        if (operation === 'insert') {
          db.insert(table_name, p.values);
        } else if (operation === 'update') {
          db.update(table_name, p.values, p.filters);
        } else if (operation === 'delete') {
          db.remove(table_name, p.filters);
        }
        results.push({ id: op.id, ok: true });
      } catch (err) {
        results.push({ id: op.id, ok: false, error: err.message });
      }
    }
    res.json({ ok: true, results });
  });

  // ── Sync: client pulls changes since a timestamp ──────────────────────────
  // Returns all rows updated after `since` across all tables
  app.get('/api/sync/changes/:since', (req, res) => {
    try {
      const since = decodeURIComponent(req.params.since);
      const TABLES = [
        'customers', 'suppliers', 'products', 'sales', 'sale_items',
        'expenses', 'expense_categories', 'transactions', 'shop_settings',
        'stock_alerts', 'stock_receivings', 'stock_receiving_items', 'eod_reports',
      ];
      const changes = {};
      for (const table of TABLES) {
        try {
          const rows = db.selectSince(table, since);
          if (rows.length > 0) changes[table] = rows;
        } catch (_) {
          // table might not exist on older DBs — skip
        }
      }
      res.json({ ok: true, since, data: changes, ts: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ── Start listening ───────────────────────────────────────────────────────
  server = app.listen(port, '0.0.0.0', () => {
    console.log(`[NetworkServer] Listening on 0.0.0.0:${port}`);
  });

  server.on('error', (err) => {
    console.error('[NetworkServer] Error:', err.message);
  });

  return server;
}

function stop() {
  if (server) {
    server.close(() => console.log('[NetworkServer] Stopped'));
    server = null;
  }
}

function isRunning() {
  return server !== null;
}

module.exports = { start, stop, isRunning };
