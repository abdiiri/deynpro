/**
 * syncEngine.cjs
 *
 * Runs on CLIENT PCs. Periodically:
 *   1. Pushes pending queue operations to the server
 *   2. Pulls changes from the server since last sync
 *   3. Applies pulled changes to the local SQLite
 *   4. Detects and flags conflicts
 *
 * Uses a simple "last-write-wins" strategy with conflict flagging:
 * if a product's quantity goes negative after merge, a conflict
 * alert is written to stock_alerts so the Notifications page shows it.
 */

const { randomUUID } = require('crypto');

let _db          = null;
let _queue       = null;
let _config      = null;
let _http        = null;
let _interval    = null;
let _lastSyncTs  = null;   // ISO string of last successful pull
let _status      = 'idle'; // 'idle' | 'syncing' | 'online' | 'offline' | 'error'
let _pendingCount = 0;
let _statusListeners = [];

const SYNC_INTERVAL_MS = 5000; // push/pull every 5 seconds when online

// ── Init ──────────────────────────────────────────────────────────────────────
function init(db, queue, config) {
  _db     = db;
  _queue  = queue;
  _config = config;

  // Lazy-load http module
  try { _http = require('http'); } catch (_) {}

  // Load last sync timestamp from a local meta table
  _ensureMetaTable();
  _lastSyncTs = _loadLastSyncTs() || new Date(0).toISOString();
}

function _ensureMetaTable() {
  _db.rawExec(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

function _loadLastSyncTs() {
  try {
    const row = _db.rawGet(`SELECT value FROM sync_meta WHERE key = 'last_sync_ts'`);
    return row?.value || null;
  } catch (_) { return null; }
}

function _saveLastSyncTs(ts) {
  _lastSyncTs = ts;
  _db.rawExec(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync_ts', ?)`,
    [ts]
  );
}

// ── HTTP helper — simple GET/POST without axios ───────────────────────────────
function _request(method, url, body) {
  return new Promise((resolve, reject) => {
    if (!_http) return reject(new Error('http module not available'));

    const parsed = new URL(url);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port:     parseInt(parsed.port) || 3001,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout: 4000,
    };

    const req = _http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`)); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (postData) req.write(postData);
    req.end();
  });
}

// ── Ping — check if server is reachable ───────────────────────────────────────
async function ping() {
  try {
    const url = _config.getServerUrl() + '/api/ping';
    const res = await _request('GET', url, null);
    return res?.ok === true;
  } catch (_) {
    return false;
  }
}

// ── Push queued operations to server ─────────────────────────────────────────
async function pushQueue() {
  const pending = _queue.getPending();
  if (pending.length === 0) return { pushed: 0, failed: 0 };

  const url = _config.getServerUrl() + '/api/sync/push';
  let pushed = 0;
  let failed = 0;

  try {
    const res = await _request('POST', url, {
      clientId: _config.getClientId(),
      operations: pending,
    });

    if (res?.ok && Array.isArray(res.results)) {
      for (const r of res.results) {
        if (r.ok) {
          _queue.markSynced(r.id);
          pushed++;
        } else {
          _queue.markFailed(r.id, r.error);
          failed++;
        }
      }
    }
  } catch (err) {
    // Mark all as failed
    for (const op of pending) {
      _queue.markFailed(op.id, err.message);
      failed++;
    }
  }

  return { pushed, failed };
}

// ── Pull changes from server since last sync ──────────────────────────────────
async function pullChanges() {
  const since = encodeURIComponent(_lastSyncTs);
  const url   = _config.getServerUrl() + `/api/sync/changes/${since}`;

  const res = await _request('GET', url, null);
  if (!res?.ok) throw new Error(res?.error || 'Pull failed');

  const changes = res.data || {};
  let applied = 0;

  for (const [table, rows] of Object.entries(changes)) {
    for (const row of rows) {
      try {
        _applyRow(table, row);
        applied++;
      } catch (err) {
        console.error(`[SyncEngine] Failed to apply row to ${table}:`, err.message);
      }
    }
  }

  // Check for stock conflicts after applying changes
  _checkStockConflicts();

  // Save the server's response timestamp as our new baseline
  if (res.ts) _saveLastSyncTs(res.ts);

  return { applied };
}

// ── Apply a single row from server into local DB ──────────────────────────────
function _applyRow(table, row) {
  // Use INSERT OR REPLACE so we don't need to check existence
  const cols = Object.keys(row);
  if (!cols.length) return;

  _db.rawExec(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map(c => row[c])
  );
}

// ── Conflict detection — flag if any product qty went negative ─────────────────
function _checkStockConflicts() {
  try {
    const negativeStock = _db.rawAll(
      `SELECT id, name, quantity FROM products WHERE quantity < 0 AND deleted_at IS NULL`
    );
    for (const p of negativeStock) {
      // Only create alert if one doesn't already exist
      const existing = _db.rawAll(
        `SELECT id FROM stock_alerts WHERE product_id = ? AND alert_type = 'sync_conflict' AND is_read = 0`,
        [p.id]
      );
      if (existing.length === 0) {
        const { randomUUID } = require('crypto');
        _db.rawExec(
          `INSERT INTO stock_alerts (id, product_id, alert_type, message, is_read, created_at)
           VALUES (?, ?, 'sync_conflict', ?, 0, datetime('now'))`,
          [randomUUID(), p.id, `Sync conflict: "${p.name}" has negative stock (${p.quantity}). Please adjust manually.`]
        );
      }
    }
  } catch (_) {}
}

// ── Full sync cycle ───────────────────────────────────────────────────────────
async function syncCycle() {
  if (!_db || !_queue || !_config) return;
  if (!_config.isClient()) return;

  _setStatus('syncing');

  try {
    const online = await ping();
    if (!online) {
      _setStatus('offline');
      _pendingCount = _queue.pendingCount();
      return;
    }

    // Push first, then pull
    await pushQueue();
    await pullChanges();

    _pendingCount = _queue.pendingCount();
    _setStatus('online');
    _queue.cleanup(7);
  } catch (err) {
    console.error('[SyncEngine] Sync cycle error:', err.message);
    _setStatus('error');
  }
}

// ── Status management ─────────────────────────────────────────────────────────
function _setStatus(s) {
  _status = s;
  for (const fn of _statusListeners) {
    try { fn(s, _pendingCount); } catch (_) {}
  }
}

function onStatusChange(fn) {
  _statusListeners.push(fn);
  return () => { _statusListeners = _statusListeners.filter(f => f !== fn); };
}

function getStatus() {
  return { status: _status, pendingCount: _pendingCount, lastSyncTs: _lastSyncTs };
}

// ── Start / stop the sync loop ────────────────────────────────────────────────
function start() {
  if (_interval) return;
  syncCycle(); // immediate first run
  _interval = setInterval(syncCycle, SYNC_INTERVAL_MS);
  console.log(`[SyncEngine] Started — syncing every ${SYNC_INTERVAL_MS / 1000}s`);
}

function stop() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  console.log('[SyncEngine] Stopped');
}

module.exports = { init, start, stop, ping, pushQueue, pullChanges, syncCycle, getStatus, onStatusChange };
