/**
 * networkConfig.cjs
 * Reads and writes the network mode config from a JSON file stored
 * alongside the database in the user's app data folder.
 *
 * Config file: <userData>/deynpro-network.json
 *
 * Schema:
 * {
 *   "mode": "server" | "client" | "standalone",
 *   "serverIp": "192.168.1.5",
 *   "serverPort": 3001,
 *   "clientId": "<uuid>"   // unique ID for this PC so server can track it
 * }
 *
 * standalone = no networking, single PC (default)
 * server     = this PC hosts the Express API, other PCs connect to it
 * client     = this PC connects to another PC running in server mode
 */

const path = require('path');
const fs   = require('fs');
const { app } = require('electron');
const { randomUUID } = require('crypto');

const SERVER_PORT = 3001;

function configPath() {
  return path.join(app.getPath('userData'), 'deynpro-network.json');
}

function load() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const cfg = JSON.parse(raw);
    // Ensure clientId always exists
    if (!cfg.clientId) {
      cfg.clientId = randomUUID();
      save(cfg);
    }
    return cfg;
  } catch (_) {
    // First run — default to standalone
    const cfg = {
      mode: 'standalone',
      serverIp: '',
      serverPort: SERVER_PORT,
      clientId: randomUUID(),
    };
    save(cfg);
    return cfg;
  }
}

function save(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
}

function getMode()      { return load().mode; }
function getServerIp()  { return load().serverIp; }
function getServerPort(){ return load().serverPort || SERVER_PORT; }
function getClientId()  { return load().clientId; }

function setMode(mode)          { const c = load(); c.mode = mode;           save(c); }
function setServerIp(ip)        { const c = load(); c.serverIp = ip;         save(c); }
function setServerPort(port)    { const c = load(); c.serverPort = port;     save(c); }

function getServerUrl() {
  const c = load();
  return `http://${c.serverIp}:${c.serverPort || SERVER_PORT}`;
}

function isServer()     { return getMode() === 'server'; }
function isClient()     { return getMode() === 'client'; }
function isStandalone() { return getMode() === 'standalone'; }

module.exports = {
  load, save,
  getMode, getServerIp, getServerPort, getClientId, getServerUrl,
  setMode, setServerIp, setServerPort,
  isServer, isClient, isStandalone,
  SERVER_PORT,
};
