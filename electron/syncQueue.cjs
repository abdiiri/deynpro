/**
 * syncQueue.cjs
 *
 * Persists every DB write operation to a local queue table so they
 * can be replayed to the server when the network comes back.
 *
 * Queue table lives in the SAME deynpro.db SQLite file.
 * Each row is one pending operation: insert / update / delete.
 *
 * Columns:
 *   id          TEXT  — UUID
 *   operation   TEXT  — 'insert' | 'update' | 'delete'
 *   table_name  TEXT  — target table
 *   payload     TEXT  — JSON: { values, filters }
 *   created_at  TEXT
 *   synced_at   TEXT  — NULL until pushed to server
 *   error       TEXT  — last sync error if any
 */

let db; // set via init()

function init(database) {
  db = database;
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          TEXT PRIMARY KEY,
      operation   TEXT NOT NULL,
      table_name  TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at   TEXT,
      error       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced_at);
  `);
}

const { randomUUID } = require('crypto');

/** Add an operation to the queue */
function enqueue(operation, tableName, payload) {
  if (!db) return;
  db.prepare(`
    INSERT INTO sync_queue (id, operation, table_name, payload, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(randomUUID(), operation, tableName, JSON.stringify(payload));
}

/** Get all unsynced operations, oldest first */
function getPending() {
  if (!db) return [];
  return db.prepare(`
    SELECT * FROM sync_queue
    WHERE synced_at IS NULL
    ORDER BY created_at ASC
  `).all();
}

/** Mark an operation as successfully synced */
function markSynced(id) {
  if (!db) return;
  db.prepare(`
    UPDATE sync_queue SET synced_at = datetime('now'), error = NULL WHERE id = ?
  `).run(id);
}

/** Mark an operation as failed with an error message */
function markFailed(id, error) {
  if (!db) return;
  db.prepare(`
    UPDATE sync_queue SET error = ? WHERE id = ?
  `).run(String(error), id);
}

/** Count of pending (unsynced) operations */
function pendingCount() {
  if (!db) return 0;
  return db.prepare(`SELECT COUNT(*) as c FROM sync_queue WHERE synced_at IS NULL`).get()?.c || 0;
}

/** Clear all synced operations older than N days (cleanup) */
function cleanup(daysOld = 7) {
  if (!db) return;
  db.prepare(`
    DELETE FROM sync_queue
    WHERE synced_at IS NOT NULL
    AND synced_at < datetime('now', ?)
  `).run(`-${daysOld} days`);
}

module.exports = { init, enqueue, getPending, markSynced, markFailed, pendingCount, cleanup };
