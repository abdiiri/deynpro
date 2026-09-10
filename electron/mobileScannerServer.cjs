/**
 * mobileScannerServer.cjs
 *
 * HTTPS + WSS server for mobile barcode scanning.
 * Self-signed cert generated once, cached in userData.
 */

const os   = require('os');
const path = require('path');
const fs   = require('fs');

let server  = null;
let wss     = null;

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function getCert(userDataPath) {
  const certFile = path.join(userDataPath, 'scanner-cert.pem');
  const keyFile  = path.join(userDataPath, 'scanner-key.pem');
  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    return { cert: fs.readFileSync(certFile, 'utf8'), key: fs.readFileSync(keyFile, 'utf8') };
  }
  try {
    const selfsigned = require('selfsigned');
    const ip = getLanIp();
    const pems = selfsigned.generate(
      [{ name: 'commonName', value: 'DeynPro' }],
      {
        days: 3650,
        keySize: 2048,
        extensions: [{
          name: 'subjectAltName',
          altNames: [
            { type: 7, ip },
            { type: 2, value: 'localhost' },
          ],
        }],
      }
    );
    fs.writeFileSync(certFile, pems.cert, 'utf8');
    fs.writeFileSync(keyFile,  pems.private, 'utf8');
    console.log('[MobileScanner] Generated self-signed cert');
    return { cert: pems.cert, key: pems.private };
  } catch (e) {
    console.warn('[MobileScanner] selfsigned not available:', e.message);
    return null;
  }
}

function buildPage(ip, port, useHttps) {
  const protocol = useHttps ? 'wss' : 'ws';
  const wsUrl    = `${protocol}://${ip}:${port}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>DeynPro Scanner</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100dvh;padding:16px;gap:10px;}
h1{font-size:1.1rem;font-weight:700;margin-top:8px;}
.sub{font-size:.72rem;color:#666;margin-bottom:4px;}
#log{width:100%;max-width:480px;background:#111;border-radius:12px;padding:12px;font-size:.78rem;font-family:monospace;color:#aaa;min-height:80px;max-height:160px;overflow-y:auto;line-height:1.6;}
#log .ok{color:#4ade80;} #log .err{color:#f87171;} #log .info{color:#60a5fa;}
#vp{width:100%;max-width:480px;aspect-ratio:4/3;border-radius:14px;overflow:hidden;position:relative;background:#111;}
video{width:100%;height:100%;object-fit:cover;display:block;}
.frame{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;}
.box{position:relative;width:190px;height:120px;}
.box::before,.box::after,.box b::before,.box b::after{content:'';position:absolute;width:24px;height:24px;border-color:#6366f1;border-style:solid;}
.box::before{top:0;left:0;border-width:3px 0 0 3px;}
.box::after{top:0;right:0;border-width:3px 3px 0 0;}
.box b::before{bottom:0;left:0;border-width:0 0 3px 3px;}
.box b::after{bottom:0;right:0;border-width:0 3px 3px 0;}
.line{position:absolute;left:4px;right:4px;height:2px;background:#6366f1;box-shadow:0 0 8px 2px rgba(99,102,241,.5);animation:scan 2s ease-in-out infinite;}
@keyframes scan{0%,100%{top:8%}50%{top:88%}}
#last{width:100%;max-width:480px;background:#18181b;border-radius:10px;padding:10px 14px;display:none;}
#last p{font-family:monospace;font-size:.95rem;color:#a5b4fc;margin-top:2px;word-break:break-all;}
#last small{font-size:.65rem;color:#555;text-transform:uppercase;letter-spacing:.05em;}
.row{width:100%;max-width:480px;display:flex;gap:8px;}
.row input{flex:1;background:#18181b;border:1px solid #333;border-radius:10px;padding:9px 12px;color:#fff;font-size:.9rem;outline:none;}
.row input:focus{border-color:#6366f1;}
.row button,.btn{background:#6366f1;border:none;border-radius:10px;padding:9px 16px;color:#fff;font-weight:600;font-size:.85rem;cursor:pointer;white-space:nowrap;}
.btn{width:100%;max-width:480px;padding:11px;margin-top:4px;}
.btn:active,.row button:active{opacity:.75;}
#torch{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:36px;height:36px;color:#fff;font-size:1rem;cursor:pointer;display:none;align-items:center;justify-content:center;}
</style>
</head>
<body>
<h1>📦 DeynPro Scanner</h1>
<div class="sub">${ip}:${port}</div>

<div id="log"><span class="info">Starting…</span></div>

<div id="vp" style="display:none">
  <video id="vid" muted playsinline autoplay></video>
  <div class="frame"><div class="box"><b></b><div class="line"></div></div></div>
  <button id="torch">🔦</button>
</div>

<div id="last"><small>Last scan</small><p id="lcode"></p></div>

<div class="row">
  <input id="min" type="text" placeholder="Type barcode + Enter" inputmode="numeric">
  <button id="msend">Send</button>
</div>

<button class="btn" id="camBtn">📷 Start Camera</button>

<script>
(function(){
  var log = document.getElementById('log');
  var vp  = document.getElementById('vp');
  var vid = document.getElementById('vid');
  var last= document.getElementById('last');
  var lcode=document.getElementById('lcode');
  var torch=document.getElementById('torch');
  var camBtn=document.getElementById('camBtn');
  var min = document.getElementById('min');
  var msend=document.getElementById('msend');

  function addLog(cls, msg){
    var line = document.createElement('div');
    line.className = cls;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────
  var ws;
  function connect(){
    addLog('info','Connecting to PC WebSocket…');
    try{ ws = new WebSocket('${wsUrl}'); }
    catch(e){ addLog('err','WebSocket error: '+e.message); return; }
    ws.onopen  = function(){ addLog('ok','✓ Connected to PC'); };
    ws.onclose = function(){ addLog('err','Disconnected — retrying in 3s…'); setTimeout(connect,3000); };
    ws.onerror = function(e){ addLog('err','WS error — is PC running?'); };
  }

  function send(code){
    code = code.trim();
    if(!code) return;
    if(ws && ws.readyState===1){
      ws.send(JSON.stringify({type:'scan',barcode:code}));
      lcode.textContent = code;
      last.style.display='block';
      addLog('ok','✓ Sent: '+code);
      try{navigator.vibrate(80);}catch(_){}
    } else {
      addLog('err','Not connected — cannot send');
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  var track, started=false;

  camBtn.addEventListener('click', function(){ startCam(); });

  function startCam(){
    if(started) return;
    camBtn.textContent='Starting camera…';
    camBtn.disabled=true;

    if(!('BarcodeDetector' in window)){
      addLog('err','BarcodeDetector not supported — use Chrome on Android');
      addLog('info','Use manual input below instead');
      camBtn.textContent='Camera not supported';
      return;
    }

    addLog('info','Requesting camera permission…');
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280}}})
    .then(function(stream){
      started=true;
      vid.srcObject=stream;
      track=stream.getVideoTracks()[0];
      vp.style.display='block';
      camBtn.style.display='none';
      addLog('ok','✓ Camera started — point at barcode');

      var caps=track.getCapabilities?track.getCapabilities():{};
      if(caps.torch){ torch.style.display='flex'; }

      var det=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','code_93','qr_code','itf','upc_a','upc_e','data_matrix','aztec','pdf417']});
      var last='', lastTs=0;

      function loop(){
        if(vid.readyState>=2){
          det.detect(vid).then(function(r){
            if(r.length){
              var code=r[0].rawValue, now=Date.now();
              if(code!==last||now-lastTs>2000){ last=code; lastTs=now; send(code); }
            }
          }).catch(function(){});
        }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    })
    .catch(function(e){
      addLog('err','Camera error: '+e.message);
      addLog('info','Use manual input below');
      camBtn.textContent='Retry Camera';
      camBtn.disabled=false;
    });
  }

  torch.addEventListener('click',function(){
    if(!track)return;
    var on=torch.dataset.on==='1';
    track.applyConstraints({advanced:[{torch:!on}]}).then(function(){
      torch.dataset.on=on?'0':'1';
      torch.style.background=on?'rgba(0,0,0,.5)':'rgba(255,200,0,.3)';
    }).catch(function(){});
  });

  // ── Manual input ──────────────────────────────────────────────────────────
  min.addEventListener('keydown',function(e){if(e.key==='Enter'){send(min.value);min.value='';}});
  msend.addEventListener('click',function(){send(min.value);min.value='';});

  // ── Boot ──────────────────────────────────────────────────────────────────
  addLog('info','Page loaded OK');
  addLog('info','HTTPS: ${useHttps}');
  connect();

  // Try auto-start camera after a short delay
  setTimeout(function(){ startCam(); }, 800);
})();
</script>
</body>
</html>`;
}

// ── Server ────────────────────────────────────────────────────────────────────

const PORT = 7779;

function start(mainWindow) {
  if (server) return getInfo();

  let userDataPath;
  try { const { app } = require('electron'); userDataPath = app.getPath('userData'); }
  catch(_) { userDataPath = os.tmpdir(); }

  let WebSocketServer;
  try { WebSocketServer = require('ws').WebSocketServer; }
  catch(_) { console.warn('[MobileScanner] ws not installed — run: npm install ws'); return null; }

  const ip    = getLanIp();
  const creds = getCert(userDataPath);
  const useHttps = !!creds;

  const page = buildPage(ip, PORT, useHttps);

  const handler = (req, res) => {
    if (req.url === '/' || req.url === '/scanner') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }
  };

  if (useHttps) {
    const https = require('https');
    server = https.createServer({ cert: creds.cert, key: creds.key }, handler);
  } else {
    const http = require('http');
    server = http.createServer(handler);
  }

  wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log('[MobileScanner] Phone connected:', clientIp);
    mainWindow?.webContents.send('mobile-scanner:connected', { ip: clientIp });

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'scan' && msg.barcode) {
          mainWindow?.webContents.send('mobile-scanner:scan', msg.barcode);
        }
      } catch(_) {}
    });
    ws.on('close', () => mainWindow?.webContents.send('mobile-scanner:disconnected', {}));
    ws.on('error', () => {});
  });

  server.listen(PORT, '0.0.0.0', () => {
    const proto = useHttps ? 'https' : 'http';
    console.log(`[MobileScanner] ${proto}://${ip}:${PORT}`);
  });

  return getInfo();
}

function stop() {
  try { wss?.close(); }    catch(_) {}
  try { server?.close(); } catch(_) {}
  wss = null; server = null;
}

function getInfo() {
  const ip = getLanIp();
  let proto = 'http';
  try { require('selfsigned'); proto = 'https'; } catch(_) {}
  return { running: !!server, ip, port: PORT, url: `${proto}://${ip}:${PORT}` };
}

module.exports = { start, stop, getInfo, MOBILE_SCANNER_PORT: PORT };
