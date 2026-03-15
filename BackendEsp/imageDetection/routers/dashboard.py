"""
Web dashboard — minimal config UI served at /dashboard.
Check device connectivity, edit IPs, scan network, toggle features, view live status.
"""
import asyncio
import re
from pathlib import Path

import httpx
from fastapi import APIRouter, Body
from fastapi.responses import HTMLResponse, JSONResponse

from config import CAM_BASE_URL, ESP_BASE_URL, ESP_IP, CAM_IP, API_PORT
from state import app_state

router = APIRouter(tags=["Dashboard"])

ENV_PATH = Path(__file__).parent.parent / ".env"

# ── Health check helpers ──────────────────────────────────────────────────────

async def _check(url: str, timeout: float = 3.0) -> dict:
    """Probe device with /status (lightweight, no sensor reads)."""
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(url, timeout=timeout)
            return {"ok": True, "status": r.status_code, "ms": round(r.elapsed.total_seconds() * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:80]}


@router.get("/api/health")
async def health_check():
    esp_task = _check(f"{ESP_BASE_URL}/status")
    cam_task = _check(f"{CAM_BASE_URL}/status")
    esp_res, cam_res = await asyncio.gather(esp_task, cam_task)
    return {
        "esp": {**esp_res, "ip": ESP_IP, "url": ESP_BASE_URL},
        "cam": {**cam_res, "ip": CAM_IP, "url": CAM_BASE_URL},
        "state": app_state.status_dict(),
    }


@router.get("/api/env")
async def get_env():
    """Return current .env values (safe to show — no full API keys)."""
    if not ENV_PATH.exists():
        return {"error": ".env not found"}
    lines = ENV_PATH.read_text().splitlines()
    env = {}
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            key = k.strip()
            val = v.strip()
            if "KEY" in key and len(val) > 8:
                val = val[:4] + "…" + val[-4:]
            env[key] = val
    return env


@router.post("/api/env")
async def update_env(updates: dict = Body(...)):
    """Patch .env with the given key-value pairs. Only whitelisted keys."""
    allowed = {"ESP_IP", "CAM_IP", "FACE_THRESHOLD", "FACE_COOLDOWN",
               "OBSTACLE_THRESHOLD_CM", "CRITICAL_THRESHOLD_CM",
               "OCR_DURATION", "API_PORT", "YOLO_MODEL",
               "CHATGPT_API_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"}

    if not ENV_PATH.exists():
        return JSONResponse({"error": ".env not found"}, 404)

    text = ENV_PATH.read_text()
    changed = []
    for key, val in updates.items():
        if key not in allowed:
            continue
        pattern = rf"^{re.escape(key)}=.*$"
        if re.search(pattern, text, re.MULTILINE):
            text = re.sub(pattern, f"{key}={val}", text, flags=re.MULTILINE)
        else:
            text += f"\n{key}={val}\n"
        changed.append(key)

    ENV_PATH.write_text(text)
    return {"updated": changed, "note": "Restart the server for changes to take effect."}


@router.post("/api/scan")
async def scan_network(subnet: str = Body(None, embed=True)):
    """Run the device scanner and return results."""
    import find_devices
    if not subnet:
        subnet = find_devices._local_subnet()
    found = await asyncio.get_event_loop().run_in_executor(
        None, find_devices.scan, subnet, find_devices.TIMEOUT
    )
    return {"subnet": subnet, "devices": found}


# ── Dashboard HTML ────────────────────────────────────────────────────────────

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Control Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .header { background: #1e293b; padding: 20px 24px; border-bottom: 1px solid #334155;
            display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 20px; font-weight: 600; }
  .header .links a { color: #60a5fa; text-decoration: none; margin-left: 16px; font-size: 14px; }
  .container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
  .card h2 { font-size: 15px; font-weight: 600; color: #94a3b8; text-transform: uppercase;
             letter-spacing: 0.5px; margin-bottom: 12px; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
  .dot-ok { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .dot-err { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
  .dot-load { background: #f59e0b; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .device-row { display: flex; align-items: center; margin-bottom: 10px; font-size: 15px; }
  .device-row .ip { color: #60a5fa; margin-left: auto; font-family: monospace; font-size: 13px; }
  .device-row .ms { color: #94a3b8; font-size: 12px; margin-left: 8px; }
  .input-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .input-row label { width: 70px; font-size: 13px; color: #94a3b8; line-height: 36px; }
  .input-row input { flex: 1; background: #0f172a; border: 1px solid #475569; border-radius: 8px;
                     padding: 8px 12px; color: #e2e8f0; font-size: 14px; font-family: monospace; }
  .input-row input:focus { outline: none; border-color: #60a5fa; }
  .btn { padding: 8px 18px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
         cursor: pointer; transition: all 0.15s; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-primary:hover { background: #2563eb; }
  .btn-green { background: #22c55e; color: white; }
  .btn-green:hover { background: #16a34a; }
  .btn-red { background: #ef4444; color: white; }
  .btn-red:hover { background: #dc2626; }
  .btn-gray { background: #475569; color: white; }
  .btn-gray:hover { background: #64748b; }
  .btn-sm { padding: 6px 14px; font-size: 12px; }
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .feature-row { display: flex; align-items: center; justify-content: space-between;
                 padding: 8px 0; border-bottom: 1px solid #334155; }
  .feature-row:last-child { border-bottom: none; }
  .feature-label { font-size: 14px; }
  .feature-val { font-size: 13px; font-family: monospace; color: #94a3b8; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .badge-on { background: #166534; color: #bbf7d0; }
  .badge-off { background: #7f1d1d; color: #fecaca; }
  .log { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px;
         font-family: monospace; font-size: 12px; height: 180px; overflow-y: auto;
         white-space: pre-wrap; color: #94a3b8; }
  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #f1f5f9; }
  .dist-bar { height: 8px; border-radius: 4px; background: #334155; margin-top: 4px; position: relative; }
  .dist-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .sensor-val { font-family: monospace; font-size: 22px; font-weight: 700; color: #f1f5f9; }
  .sensor-label { font-size: 12px; color: #64748b; margin-top: 2px; }
  .sensor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; }
  .alert-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px;
                background: #0f172a; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #22c55e; }
  .alert-item .name { font-weight: 700; font-size: 15px; color: #f1f5f9; }
  .alert-item .meta { font-size: 12px; color: #94a3b8; }
  .alert-item .score { font-family: monospace; font-size: 13px; color: #60a5fa; }
  .alert-icon { font-size: 22px; }
  .camera-box { position: relative; background: #0f172a; border-radius: 8px; overflow: hidden;
                text-align: center; min-height: 200px; }
  .camera-box img { max-width: 100%; height: auto; border-radius: 8px; display: block; }
  .camera-box .overlay { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6);
                         padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #22c55e; }
  .camera-placeholder { display: flex; align-items: center; justify-content: center;
                        height: 200px; color: #475569; font-size: 14px; }
  .face-counter { font-size: 48px; font-weight: 800; color: #f1f5f9; line-height: 1; }
  .face-counter-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  .known-faces-list { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .known-tag { background: #1e3a5f; color: #93c5fd; padding: 2px 10px; border-radius: 12px;
               font-size: 12px; font-weight: 500; }
  .full-width { grid-column: 1 / -1; }
</style>
</head>
<body>

<div class="header">
  <h1>ESP32 Control Panel</h1>
  <div class="links">
    <a href="/docs">API Docs</a>
    <a href="/esp/help">ESP Routes</a>
    <a href="/cam/help">CAM Routes</a>
  </div>
</div>

<div class="container">

<!-- Connection status -->
<div class="grid">
  <div class="card">
    <h2>ESP32 Senzori</h2>
    <div class="device-row">
      <span class="status-dot dot-load" id="esp-dot"></span>
      <span id="esp-status">Checking…</span>
      <span class="ip" id="esp-ip">—</span>
      <span class="ms" id="esp-ms"></span>
    </div>
    <div class="input-row">
      <label>IP:</label>
      <input id="esp-ip-input" placeholder="10.210.85.244">
    </div>
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" onclick="saveIP('ESP_IP','esp-ip-input')">Save IP</button>
      <a class="btn btn-gray btn-sm" id="esp-link" href="#" target="_blank">Open Dashboard</a>
    </div>
  </div>
  <div class="card">
    <h2>ESP32-CAM</h2>
    <div class="device-row">
      <span class="status-dot dot-load" id="cam-dot"></span>
      <span id="cam-status">Checking…</span>
      <span class="ip" id="cam-ip">—</span>
      <span class="ms" id="cam-ms"></span>
    </div>
    <div class="input-row">
      <label>IP:</label>
      <input id="cam-ip-input" placeholder="10.210.85.207">
    </div>
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" onclick="saveIP('CAM_IP','cam-ip-input')">Save IP</button>
      <a class="btn btn-gray btn-sm" id="cam-link" href="#" target="_blank">Open Stream</a>
    </div>
  </div>
</div>

<!-- Scanner -->
<div class="card" style="margin-bottom:16px">
  <h2>Network Scanner</h2>
  <div class="btn-row" style="align-items:center">
    <input id="scan-subnet" placeholder="auto-detect" style="background:#0f172a;border:1px solid #475569;
           border-radius:8px;padding:8px 12px;color:#e2e8f0;font-family:monospace;font-size:13px;width:160px">
    <button class="btn btn-primary btn-sm" onclick="runScan()" id="scan-btn">Scan Network</button>
    <span id="scan-result" style="font-size:13px;color:#94a3b8;margin-left:12px"></span>
  </div>
</div>

<!-- Camera + Face Detection -->
<div class="grid">
  <div class="card">
    <h2>Camera Live</h2>
    <div class="camera-box" id="cam-box">
      <div class="camera-placeholder" id="cam-placeholder">Camera offline — asteapta stream…</div>
      <img id="cam-img" style="display:none" alt="Camera">
      <div class="overlay" id="cam-overlay" style="display:none">
        <span id="cam-faces-count">0</span> fete detectate
      </div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; align-items:center;">
      <span style="font-size:13px;color:#94a3b8">Persoane cunoscute:</span>
      <div class="known-faces-list" id="known-faces"></div>
    </div>
  </div>
  <div class="card">
    <h2>Alerte Fete Detectate</h2>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:14px;">
      <div style="text-align:center">
        <div class="face-counter" id="face-total">0</div>
        <div class="face-counter-label">Total alerte</div>
      </div>
      <div style="text-align:center">
        <div class="face-counter" id="face-live" style="color:#22c55e">0</div>
        <div class="face-counter-label">Fete in cadru</div>
      </div>
    </div>
    <div id="face-alert-banner" style="display:none; background:#14532d; border:1px solid #22c55e;
         border-radius:10px; padding:12px 16px; margin-bottom:12px; animation: pulse 2s infinite;">
      <div style="font-size:16px;font-weight:700;color:#bbf7d0" id="banner-text"></div>
      <div style="font-size:12px;color:#86efac" id="banner-meta"></div>
    </div>
    <div id="face-events-list" style="max-height:260px;overflow-y:auto;">
      <div style="color:#475569;font-size:13px;text-align:center;padding:20px">Inca nu s-a detectat nimeni…</div>
    </div>
  </div>
</div>

<!-- Distances + Sensors -->
<div class="grid">
  <div class="card">
    <h2>Distante (Live)</h2>
    <div class="sensor-grid" id="dist-grid">
      <div><div class="sensor-val" id="d-front">—</div><div class="sensor-label">Fata (S1)</div></div>
      <div><div class="sensor-val" id="d-left">—</div><div class="sensor-label">Stanga (S2)</div></div>
      <div><div class="sensor-val" id="d-right">—</div><div class="sensor-label">Dreapta (S3)</div></div>
    </div>
  </div>
  <div class="card">
    <h2>Senzori</h2>
    <div class="sensor-grid" id="sensor-grid">
      <div><div class="sensor-val" id="s-temp">—</div><div class="sensor-label">Temp</div></div>
      <div><div class="sensor-val" id="s-hum">—</div><div class="sensor-label">Umiditate</div></div>
      <div><div class="sensor-val" id="s-air">—</div><div class="sensor-label">Aer (MQ135)</div></div>
    </div>
  </div>
</div>

<!-- Feature toggles + Motors -->
<div class="grid">
  <div class="card">
    <h2>Functionalitati</h2>
    <div class="feature-row">
      <span class="feature-label">Face Recognition</span>
      <span class="badge badge-on" id="f-face">ON</span>
    </div>
    <div class="feature-row">
      <span class="feature-label">Haptic Monitor</span>
      <span class="badge" id="f-haptic">—</span>
      <div class="btn-row">
        <button class="btn btn-green btn-sm" onclick="apiPost('/haptic/enable')">Enable</button>
        <button class="btn btn-red btn-sm" onclick="apiPost('/haptic/disable')">Disable</button>
      </div>
    </div>
    <div class="feature-row">
      <span class="feature-label">OCR</span>
      <span class="badge" id="f-ocr">—</span>
      <button class="btn btn-primary btn-sm" onclick="apiPost('/ocr')">Toggle</button>
    </div>
    <div class="feature-row">
      <span class="feature-label">YOLO</span>
      <span class="badge" id="f-yolo">—</span>
      <button class="btn btn-primary btn-sm" onclick="apiPost('/detect')">Toggle</button>
    </div>
    <div class="feature-row">
      <span class="feature-label">GPT Describe</span>
      <span class="badge" id="f-gpt">—</span>
      <button class="btn btn-primary btn-sm" onclick="apiPost('/describe')">Trigger</button>
    </div>
  </div>
  <div class="card">
    <h2>Motoare Haptice</h2>
    <div class="btn-row" style="margin-bottom:12px">
      <button class="btn btn-green btn-sm" onclick="espGet('/all/on')">ALL ON</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/all/off')">ALL OFF</button>
      <button class="btn btn-gray btn-sm" onclick="espGet('/all/toggle')">TOGGLE</button>
    </div>
    <div class="feature-row"><span>M1 (Fata)</span>
      <div class="btn-row"><button class="btn btn-green btn-sm" onclick="espGet('/m1/on')">ON</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/m1/off')">OFF</button></div></div>
    <div class="feature-row"><span>M2 (Stanga)</span>
      <div class="btn-row"><button class="btn btn-green btn-sm" onclick="espGet('/m2/on')">ON</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/m2/off')">OFF</button></div></div>
    <div class="feature-row"><span>M3 (Dreapta)</span>
      <div class="btn-row"><button class="btn btn-green btn-sm" onclick="espGet('/m3/on')">ON</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/m3/off')">OFF</button></div></div>
    <div class="feature-row"><span>M4 (Critic)</span>
      <div class="btn-row"><button class="btn btn-green btn-sm" onclick="espGet('/m4/on')">ON</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/m4/off')">OFF</button></div></div>

    <h2 style="margin-top:16px">Camera Flash</h2>
    <div class="btn-row">
      <button class="btn btn-green btn-sm" onclick="camGet('/flash/on')">ON</button>
      <button class="btn btn-red btn-sm" onclick="camGet('/flash/off')">OFF</button>
      <button class="btn btn-gray btn-sm" onclick="camGet('/flash/toggle')">Toggle</button>
    </div>

    <h2 style="margin-top:16px">Bluetooth</h2>
    <div class="btn-row">
      <button class="btn btn-green btn-sm" onclick="espGet('/bt/start')">Start BT</button>
      <button class="btn btn-red btn-sm" onclick="espGet('/bt/stop')">Stop BT</button>
    </div>

    <h2 style="margin-top:16px">TTS Test</h2>
    <div class="input-row">
      <input id="tts-text" placeholder="Scrie text pentru TTS…" style="background:#0f172a;border:1px solid #475569;border-radius:8px;padding:8px 12px;color:#e2e8f0;font-size:13px;flex:1">
      <button class="btn btn-primary btn-sm" onclick="ttsSpeak()">Speak</button>
    </div>
  </div>
</div>

<!-- System -->
<div class="card">
  <h2>System</h2>
  <div class="btn-row">
    <button class="btn btn-red btn-sm" onclick="espGet('/restart')">Restart ESP32</button>
    <button class="btn btn-red btn-sm" onclick="camGet('/restart')">Restart Camera</button>
    <button class="btn btn-gray btn-sm" onclick="apiDel('/tts/cache')">Clear TTS Cache</button>
  </div>
</div>

</div>

<script>
const BASE = '';

async function fetchHealth() {
  try {
    const r = await fetch(BASE + '/api/health');
    const d = await r.json();
    setDevice('esp', d.esp);
    setDevice('cam', d.cam);
    setState(d.state);
  } catch(e) { console.error(e); }
}

function setDevice(prefix, info) {
  const dot = document.getElementById(prefix+'-dot');
  const status = document.getElementById(prefix+'-status');
  const ip = document.getElementById(prefix+'-ip');
  const ms = document.getElementById(prefix+'-ms');
  const input = document.getElementById(prefix+'-ip-input');
  const link = document.getElementById(prefix+'-link');

  ip.textContent = info.ip;
  input.value = info.ip;
  link.href = info.url;

  if (info.ok) {
    dot.className = 'status-dot dot-ok';
    status.textContent = 'Connected';
    ms.textContent = info.ms + 'ms';
  } else {
    dot.className = 'status-dot dot-err';
    status.textContent = 'Offline';
    ms.textContent = '';
  }
}

function setState(s) {
  setBadge('f-face', s.face_recognition);
  setBadge('f-haptic', s.haptic_enabled);
  setBadge('f-ocr', s.ocr_active);
  setBadge('f-yolo', s.yolo_active);
  setBadge('f-gpt', s.gpt_requesting);

  const dist = s.last_distances || {};
  setDist('d-front', dist.front);
  setDist('d-left', dist.left);
  setDist('d-right', dist.right);

  document.getElementById('face-live').textContent = s.faces_in_frame || 0;
  const fcount = document.getElementById('cam-faces-count');
  if (fcount) fcount.textContent = s.faces_in_frame || 0;

  const overlay = document.getElementById('cam-overlay');
  if (overlay) overlay.style.display = s.faces_in_frame > 0 ? 'block' : 'none';

  const alert = s.last_face_alert;
  const banner = document.getElementById('face-alert-banner');
  if (alert && banner) {
    banner.style.display = 'block';
    document.getElementById('banner-text').textContent = alert.name + ' e in fata ta!';
    document.getElementById('banner-meta').textContent =
      'Scor: ' + alert.score + ' | ' + (alert.gender||'') + '/' + (alert.age||'?') + ' | ' + alert.time_ago;
  }
}

function setBadge(id, val) {
  const el = document.getElementById(id);
  el.textContent = val ? 'ON' : 'OFF';
  el.className = 'badge ' + (val ? 'badge-on' : 'badge-off');
}

function setDist(id, val) {
  const el = document.getElementById(id);
  if (val == null) { el.textContent = '—'; el.style.color = '#64748b'; }
  else {
    el.textContent = val.toFixed(1) + ' cm';
    el.style.color = val < 30 ? '#ef4444' : val < 50 ? '#f59e0b' : '#22c55e';
  }
}

async function loadSensors() {
  try {
    const r = await fetch(BASE + '/esp/sensors');
    const d = await r.json();
    if (d.dht11) {
      document.getElementById('s-temp').textContent =
        d.dht11.temperature != null ? d.dht11.temperature.toFixed(1) + '°C' : '—';
      document.getElementById('s-hum').textContent =
        d.dht11.humidity != null ? d.dht11.humidity.toFixed(0) + '%' : '—';
    }
    if (d.mq135) {
      document.getElementById('s-air').textContent = d.mq135.raw || '—';
    }
  } catch(e) {}
}

async function saveIP(key, inputId) {
  const val = document.getElementById(inputId).value.trim();
  if (!val) return;
  await fetch(BASE + '/api/env', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({[key]: val})
  });
  alert('Saved ' + key + '=' + val + '\\nRestart server to apply.');
}

async function runScan() {
  const btn = document.getElementById('scan-btn');
  const res = document.getElementById('scan-result');
  const subnet = document.getElementById('scan-subnet').value.trim() || null;
  btn.disabled = true; btn.textContent = 'Scanning…';
  res.textContent = '';
  try {
    const r = await fetch(BASE + '/api/scan', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({subnet})
    });
    const d = await r.json();
    const n = d.devices ? d.devices.length : 0;
    let txt = n + ' device(s) found on ' + d.subnet + '.x';
    if (d.devices) d.devices.forEach(dev => {
      txt += '  |  ' + dev.type + ' @ ' + dev.ip;
    });
    res.textContent = txt;
  } catch(e) { res.textContent = 'Scan error: ' + e; }
  btn.disabled = false; btn.textContent = 'Scan Network';
}

async function apiPost(path) { await fetch(BASE + path, {method:'POST'}); fetchHealth(); }
async function apiDel(path)  { await fetch(BASE + path, {method:'DELETE'}); }
async function espGet(path)  { await fetch(BASE + '/esp' + path); }
async function camGet(path)  { await fetch(BASE + '/cam' + path); }

async function ttsSpeak() {
  const text = document.getElementById('tts-text').value.trim();
  if (!text) return;
  await fetch(BASE + '/tts', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({text})
  });
}

// ── Camera snapshot ──────────────────────────────────────────────────────
let camLoading = false;
function refreshSnapshot() {
  if (camLoading) return;
  const img = document.getElementById('cam-img');
  const ph = document.getElementById('cam-placeholder');
  camLoading = true;
  const t = new Date().getTime();
  const tmp = new Image();
  tmp.onload = function() {
    img.src = tmp.src;
    img.style.display = 'block';
    ph.style.display = 'none';
    camLoading = false;
  };
  tmp.onerror = function() {
    img.style.display = 'none';
    ph.style.display = 'flex';
    camLoading = false;
  };
  tmp.src = BASE + '/cam/snapshot?' + t;
}

// ── Face events ─────────────────────────────────────────────────────────
async function loadFaceEvents() {
  try {
    const r = await fetch(BASE + '/face/events?limit=15');
    const d = await r.json();
    const list = document.getElementById('face-events-list');
    const total = document.getElementById('face-total');
    total.textContent = d.events ? d.events.length : 0;

    // Known faces tags
    const kf = document.getElementById('known-faces');
    if (d.known_faces && kf) {
      kf.innerHTML = d.known_faces.map(n =>
        '<span class="known-tag">' + n + '</span>'
      ).join('');
    }

    if (!d.events || d.events.length === 0) {
      list.innerHTML = '<div style="color:#475569;font-size:13px;text-align:center;padding:20px">Inca nu s-a detectat nimeni…</div>';
      return;
    }
    list.innerHTML = d.events.map(ev =>
      '<div class="alert-item">' +
        '<div class="alert-icon">👤</div>' +
        '<div style="flex:1">' +
          '<div class="name">' + ev.name + '</div>' +
          '<div class="meta">' + (ev.gender||'') + '/' + (ev.age||'?') + ' — ' + ev.time_ago + '</div>' +
        '</div>' +
        '<div class="score">' + ev.score + '</div>' +
      '</div>'
    ).join('');
  } catch(e) { console.error('face events:', e); }
}

// Auto-refresh
fetchHealth();
loadSensors();
loadFaceEvents();
refreshSnapshot();
setInterval(fetchHealth, 3000);
setInterval(loadSensors, 5000);
setInterval(loadFaceEvents, 2000);
setInterval(refreshSnapshot, 1500);
</script>
</body>
</html>"""


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return DASHBOARD_HTML
