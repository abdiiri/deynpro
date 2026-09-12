const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const Store = require('electron-store');
const fs   = require('fs');
const os   = require('os');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const db              = require('./db.cjs');
const license         = require('./license.cjs');
const backup          = require('./backupService.cjs');
const netConfig       = require('./networkConfig.cjs');
const netServer       = require('./networkServer.cjs');
const syncQueue       = require('./syncQueue.cjs');
const syncEngine      = require('./syncEngine.cjs');
const mobileScanner   = require('./mobileScannerServer.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Spoof user-agent so WhatsApp Web (and other sites that block old Chromium)
  // see a supported Chrome version instead of Electron's bundled one.
  const session = mainWindow.webContents.session;
  const ua = mainWindow.webContents.getUserAgent()
    .replace(/Electron\/[\d.]+\s*/g, '')
    .replace(/Chrome\/[\d.]+/, 'Chrome/148.0.7778.168');
  session.setUserAgent(ua);
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);
  // DO NOT open dev tools in production
  
  // Disable keyboard shortcuts that open dev tools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (
      input.control && input.shift && input.key.toLowerCase() === 'i' ||
      input.control && input.shift && input.key.toLowerCase() === 'j' ||
      input.control && input.shift && input.key.toLowerCase() === 'c' ||
      input.key === 'F12'
    ) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  // Remove the default Electron menu (contains dev tools, reload, etc.)
  Menu.setApplicationMenu(null);

  // Opens (or creates) whichever shop's database this device is currently
  // activated for — a fresh install with no license yet gets a neutral
  // placeholder file until activation. See electron/db.cjs for why this is
  // now per-shop instead of one shared file.
  db.init(license.getStoredShopId());

  // ── Auto-backup: start scheduler immediately on app launch ───────────────
  // This runs even before any UI is shown, so backup works as long as the
  // Electron process is running. Also check if yesterday's backup was missed.
  const OFFLINE_USER_ID = 'offline-user';
  try {
    backup.runMissedBackupCheck(OFFLINE_USER_ID);
    backup.scheduleBackup(OFFLINE_USER_ID);
    console.log('[Main] Auto-backup scheduler started');
  } catch (err) {
    console.error('[Main] Failed to start backup scheduler:', err.message);
  }

  const mode = netConfig.getMode();
  console.log(`[Main] Network mode: ${mode}`);

  if (mode === 'server') {
    // ── SERVER MODE: start the Express API so other PCs can connect ────────
    const port = netConfig.getServerPort();
    netServer.start(db, port);
    console.log(`[Main] Network server started on port ${port}`);
  } else if (mode === 'client') {
    // ── CLIENT MODE: start sync engine to push/pull from server ────────────
    syncEngine.init(db, syncQueue, netConfig);
    syncEngine.start();
    console.log(`[Main] Sync engine started — server: ${netConfig.getServerUrl()}`);

    // Forward sync status changes to the renderer
    syncEngine.onStatusChange((status, pendingCount) => {
      mainWindow?.webContents.send('sync:status', { status, pendingCount });
    });
  }
  // standalone mode: nothing extra needed

  createWindow();

  // ── Mobile Scanner: always start so phone can scan on any mode ─────────────
  mobileScanner.start(mainWindow);

  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  syncEngine.stop();
  netServer.stop();
  mobileScanner.stop();
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================
// IPC handlers — DB calls
// On CLIENT mode these still write to local SQLite AND enqueue
// for sync. On SERVER/STANDALONE they write to local SQLite only.
// ============================================================

ipcMain.handle('db:select', (_e, table, filters) => {
  // Always read from local DB (server pulls keep it up to date)
  return db.select(table, filters);
});

ipcMain.handle('db:insert', (_e, table, values) => {
  const row = db.insert(table, values);
  if (netConfig.isClient()) {
    syncQueue.enqueue('insert', table, { values: row });
  }
  return row;
});

ipcMain.handle('db:update', (_e, table, values, filters) => {
  const result = db.update(table, values, filters);
  if (netConfig.isClient()) {
    syncQueue.enqueue('update', table, { values, filters });
  }
  return result;
});

ipcMain.handle('db:delete', (_e, table, filters) => {
  const result = db.remove(table, filters);
  if (netConfig.isClient()) {
    syncQueue.enqueue('delete', table, { filters });
  }
  return result;
});

ipcMain.handle('db:exportAll', () => db.exportAll());
ipcMain.handle('db:importAll', (_e, payload) => db.importAll(payload));

// ============================================================
// Network config IPC — used by Settings page (UI to be added later)
// ============================================================

ipcMain.handle('net:getConfig', () => netConfig.load());

ipcMain.handle('net:setMode', async (_e, mode) => {
  netConfig.setMode(mode);
  // Changes take effect on next app restart
  return { ok: true, restart: true };
});

ipcMain.handle('net:setServerIp', (_e, ip) => {
  netConfig.setServerIp(ip);
  return { ok: true };
});

ipcMain.handle('net:setServerPort', (_e, port) => {
  netConfig.setServerPort(port);
  return { ok: true };
});

ipcMain.handle('net:ping', async () => {
  if (!netConfig.isClient()) return { ok: false, error: 'Not in client mode' };
  const online = await syncEngine.ping();
  return { ok: online };
});

ipcMain.handle('net:getSyncStatus', () => {
  return syncEngine.getStatus();
});

ipcMain.handle('net:forcSync', async () => {
  if (!netConfig.isClient()) return { ok: false, error: 'Not in client mode' };
  await syncEngine.syncCycle();
  return syncEngine.getStatus();
});

// ============================================================
// Backup Service IPC handlers
// ============================================================

ipcMain.handle('backup:export-today-invoices', async (_e, userId) => {
  try {
    const result = backup.exportTodayInvoices(userId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:get-history', async () => {
  try {
    return { success: true, data: backup.getBackupHistory() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:open-folder', async () => {
  try {
    backup.openBackupFolder();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:start-scheduler', async (_e, userId) => {
  try {
    backup.scheduleBackup(userId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:cancel-scheduler', async () => {
  try {
    backup.cancelBackup();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('backup:get-next-time', async () => {
  try {
    return { success: true, data: backup.getNextMidnight() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Mobile Scanner IPC handlers
// ============================================================

ipcMain.handle('mobile-scanner:getInfo', () => mobileScanner.getInfo());

// ============================================================
// PIN Lock IPC handlers
// electron-store keeps the hashed PIN in the OS keychain-safe
// app data folder (not in the SQLite DB, so it survives a DB reset).
// We store a bcrypt-style simple hash using Node's crypto so we
// don't need an extra native dep — just a salted SHA-256.
// ============================================================

const crypto = require('crypto');
const pinStore = new Store({ name: 'pin-lock', encryptionKey: 'deynpro-pin-v1' });

function hashPin(pin) {
  const salt = pinStore.get('pin_salt') || crypto.randomBytes(16).toString('hex');
  pinStore.set('pin_salt', salt);
  return crypto.createHmac('sha256', salt).update(pin).digest('hex');
}

ipcMain.handle('pin:get-status', () => ({
  enabled: pinStore.get('pin_enabled', false),
  hasPin:  !!pinStore.get('pin_hash'),
}));

ipcMain.handle('pin:set', (_e, pin) => {
  if (!pin || pin.length < 4) return { ok: false, error: 'PIN must be at least 4 digits' };
  pinStore.set('pin_hash', hashPin(pin));
  pinStore.set('pin_enabled', true);
  return { ok: true };
});

ipcMain.handle('pin:verify', (_e, pin) => {
  const stored = pinStore.get('pin_hash');
  if (!stored) return { ok: true }; // no pin set — always pass
  const match = hashPin(pin) === stored;
  return { ok: match };
});

ipcMain.handle('pin:disable', (_e, pin) => {
  const stored = pinStore.get('pin_hash');
  if (stored && hashPin(pin) !== stored) return { ok: false, error: 'Wrong PIN' };
  pinStore.delete('pin_hash');
  pinStore.delete('pin_salt');
  pinStore.set('pin_enabled', false);
  return { ok: true };
});

ipcMain.handle('pin:toggle-enabled', (_e, enabled) => {
  pinStore.set('pin_enabled', enabled);
  return { ok: true };
});

// ── Forgot PIN — offline, signed reset codes (same keypair as licenses) ────
// A random 6-digit challenge is shown on screen; the shop owner reads it to
// support, who signs {shopId, nonce} into a DPR1. code with the private key.
// Pasting it back here proves it was really issued by support for THIS
// specific forgot-PIN moment on THIS machine — it can't be reused elsewhere
// or later, since the nonce is deleted the instant it's consumed.

ipcMain.handle('pin:forgot-get-challenge', () => {
  let nonce = pinStore.get('reset_nonce');
  if (!nonce) {
    nonce = String(crypto.randomInt(100000, 999999));
    pinStore.set('reset_nonce', nonce);
  }
  const status = license.getStatus();
  return { nonce, shopId: status.shopId || null, shopName: status.shopName || null };
});

ipcMain.handle('pin:forgot-regenerate-challenge', () => {
  const nonce = String(crypto.randomInt(100000, 999999));
  pinStore.set('reset_nonce', nonce);
  return { nonce };
});

ipcMain.handle('pin:forgot-verify', (_e, code) => {
  const result = license.verifyRawCode(code);
  if (!result.valid) return { ok: false, error: result.error };
  if (result.prefix !== 'DPR1') return { ok: false, error: 'This is not a PIN reset code.' };

  const payload = result.payload;
  const storedNonce = pinStore.get('reset_nonce');
  if (!storedNonce || !payload || payload.nonce !== storedNonce) {
    return { ok: false, error: 'This code has expired or was already used. Generate a new one and try again.' };
  }

  const status = license.getStatus();
  if (status.shopId && payload.shopId && payload.shopId !== status.shopId) {
    return { ok: false, error: 'This code was issued for a different shop.' };
  }

  // Valid — clear the PIN and consume the nonce so this exact code can never work again.
  pinStore.delete('pin_hash');
  pinStore.delete('pin_salt');
  pinStore.delete('reset_nonce');
  pinStore.set('pin_enabled', false);
  return { ok: true };
});

// ============================================================
// Invoice PDF save + file reveal IPC handlers
// ============================================================

ipcMain.handle('file:save-pdf', async (_e, { fileName, pdfBytes }) => {
  const dir = path.join(os.homedir(), 'Documents', 'DeynPro', 'Invoices');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, Buffer.from(pdfBytes));
  return { ok: true, filePath };
});

ipcMain.handle('file:show-in-folder', async (_e, filePath) => {
  shell.showItemInFolder(filePath);
  return { ok: true };
});

// ============================================================
// License IPC handlers — fully offline, signature + local clock only
// ============================================================

ipcMain.handle('license:get-status', () => license.getStatus());
ipcMain.handle('license:activate', (_e, code) => license.activate(code));
ipcMain.handle('license:clear', () => license.clear());
ipcMain.handle('license:pull-snapshot', () => license.pullSnapshot());
ipcMain.handle('license:push-snapshot', () => license.pushSnapshot());
ipcMain.handle('license:check-snapshot', () => license.checkSnapshot());
ipcMain.handle('license:start-fresh-snapshot', () => license.startFreshSnapshot());

autoUpdater.on('update-available',  () => console.log('Update available...'));
autoUpdater.on('update-downloaded', () => { autoUpdater.quitAndInstall(); });
autoUpdater.on('error', err => console.log('Auto update error:', err));

// ============================================================
// Thermal receipt printing via electron-pos-printer
// ============================================================
ipcMain.handle('thermal:print', async (_e, { lines, printerName }) => {
  try {
    const { PosPrinter } = require('electron-pos-printer');
    const options = {
      preview: false,
      width: '80mm',
      margin: '0 0 0 0',
      copies: 1,
      printerName: printerName || undefined,
      timeOutPerLine: 400,
      silent: true,
    };
    await PosPrinter.print(lines, options);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('thermal:get-printers', async () => {
  try {
    const { PosPrinter } = require('electron-pos-printer');
    const printers = await PosPrinter.getPrinters();
    return { ok: true, printers };
  } catch (err) {
    return { ok: false, printers: [], error: err.message };
  }
});
