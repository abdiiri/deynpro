const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes a minimal, safe API to the renderer.
 * The renderer never touches Node, fs, or sqlite directly.
 */
contextBridge.exposeInMainWorld('electronDB', {
  select: (table, filters) => ipcRenderer.invoke('db:select', table, filters),
  insert: (table, values) => ipcRenderer.invoke('db:insert', table, values),
  update: (table, values, filters) => ipcRenderer.invoke('db:update', table, values, filters),
  remove: (table, filters) => ipcRenderer.invoke('db:delete', table, filters),
  exportAll: () => ipcRenderer.invoke('db:exportAll'),
  importAll: (payload) => ipcRenderer.invoke('db:importAll', payload),
});

contextBridge.exposeInMainWorld('electronEnv', {
  isElectron: true,
  platform: process.platform,
});

// Backup API — exposed separately so useAutoBackup hooks can reach it
contextBridge.exposeInMainWorld('electronBackup', {
  exportTodayInvoices: (userId) => ipcRenderer.invoke('backup:export-today-invoices', userId),
  getHistory: () => ipcRenderer.invoke('backup:get-history'),
  openFolder: () => ipcRenderer.invoke('backup:open-folder'),
  startScheduler: (userId) => ipcRenderer.invoke('backup:start-scheduler', userId),
  cancelScheduler: () => ipcRenderer.invoke('backup:cancel-scheduler'),
  getNextTime: () => ipcRenderer.invoke('backup:get-next-time'),
});

// Mobile Scanner API — used by BarcodeScanner component
contextBridge.exposeInMainWorld('electronMobileScanner', {
  getInfo: () => ipcRenderer.invoke('mobile-scanner:getInfo'),
  onScan: (cb) => {
    const handler = (_e, barcode) => cb(barcode);
    ipcRenderer.on('mobile-scanner:scan', handler);
    return () => ipcRenderer.removeListener('mobile-scanner:scan', handler);
  },
  onConnected: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mobile-scanner:connected', handler);
    return () => ipcRenderer.removeListener('mobile-scanner:connected', handler);
  },
  onDisconnected: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mobile-scanner:disconnected', handler);
    return () => ipcRenderer.removeListener('mobile-scanner:disconnected', handler);
  },
});
contextBridge.exposeInMainWorld('electronNet', {
  getConfig:     ()        => ipcRenderer.invoke('net:getConfig'),
  setMode:       (mode)    => ipcRenderer.invoke('net:setMode', mode),
  setServerIp:   (ip)      => ipcRenderer.invoke('net:setServerIp', ip),
  setServerPort: (port)    => ipcRenderer.invoke('net:setServerPort', port),
  ping:          ()        => ipcRenderer.invoke('net:ping'),
  getSyncStatus: ()        => ipcRenderer.invoke('net:getSyncStatus'),
  forceSync:     ()        => ipcRenderer.invoke('net:forcSync'),
  // Listen for real-time status pushes from the sync engine
  onSyncStatus:  (cb)      => {
    ipcRenderer.on('sync:status', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('sync:status');
  },
});

// PIN lock API
contextBridge.exposeInMainWorld('electronPin', {
  getStatus:     ()        => ipcRenderer.invoke('pin:get-status'),
  set:           (pin)     => ipcRenderer.invoke('pin:set', pin),
  verify:        (pin)     => ipcRenderer.invoke('pin:verify', pin),
  disable:       (pin)     => ipcRenderer.invoke('pin:disable', pin),
  toggleEnabled: (enabled) => ipcRenderer.invoke('pin:toggle-enabled', enabled),
  forgotGetChallenge:    ()     => ipcRenderer.invoke('pin:forgot-get-challenge'),
  forgotRegenerate:      ()     => ipcRenderer.invoke('pin:forgot-regenerate-challenge'),
  forgotVerify:          (code) => ipcRenderer.invoke('pin:forgot-verify', code),
});

// File utilities (PDF save, folder reveal)
contextBridge.exposeInMainWorld('electronFile', {
  savePdf:      (fileName, pdfBytes) => ipcRenderer.invoke('file:save-pdf', { fileName, pdfBytes }),
  showInFolder: (filePath)           => ipcRenderer.invoke('file:show-in-folder', filePath),
});

// Thermal printer API
contextBridge.exposeInMainWorld('electronThermal', {
  print:       (lines, printerName) => ipcRenderer.invoke('thermal:print', { lines, printerName }),
  getPrinters: ()                   => ipcRenderer.invoke('thermal:get-printers'),
});

// License API — fully offline verification, no network calls
contextBridge.exposeInMainWorld('electronLicense', {
  getStatus: ()     => ipcRenderer.invoke('license:get-status'),
  activate:  (code) => ipcRenderer.invoke('license:activate', code),
  clear:     ()     => ipcRenderer.invoke('license:clear'),
});
