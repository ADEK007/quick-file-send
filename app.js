import express from 'express';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
export const rooms = new Map();
export const ROOM_TTL = 3 * 60 * 60 * 1000; // 3 hours

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

export function newId() {
  return crypto.randomBytes(4).toString('hex');
}

export function newPeerId() {
  return crypto.randomBytes(6).toString('hex');
}

export function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Clean up expired rooms and inactive HTTP peers
export function cleanRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.clients) {
      for (const client of room.clients) {
        if (client.readyState !== 1) room.clients.delete(client);
      }
    }
    if (room.httpPeers) {
      for (const [peerId, peer] of room.httpPeers) {
        if (now - peer.lastSeen > 60_000) {
          room.httpPeers.delete(peerId);
        }
      }
    }
    const wsSize = room.clients ? room.clients.size : 0;
    const httpSize = room.httpPeers ? room.httpPeers.size : 0;
    const totalSize = wsSize + httpSize;

    if (now - room.createdAt > ROOM_TTL || (totalSize === 0 && now - room.createdAt > 900_000)) {
      rooms.delete(id);
    }
  }
}
setInterval(cleanRooms, 30_000).unref();

// Helper to get or create room
export function getOrCreateRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      createdAt: Date.now(),
      clients: new Set(),
      httpPeers: new Map(),
      messages: [],
      msgCounter: 1
    });
  }
  const room = rooms.get(id);
  if (!room.httpPeers) room.httpPeers = new Map();
  if (!room.messages) room.messages = [];
  if (!room.msgCounter) room.msgCounter = 1;
  return room;
}

// API Routes
app.get('/api/info', (_req, res) => {
  const localIp = getLocalIp();
  res.json({
    status: 'ok',
    name: 'Quick File Share',
    localIp,
    port: process.env.PORT || 3000,
    localUrl: `http://${localIp}:${process.env.PORT || 3000}`,
    activeRooms: rooms.size,
    serverless: !!process.env.VERCEL
  });
});

app.get('/api/room', (_req, res) => {
  let id = newId();
  while (rooms.has(id)) id = newId();
  getOrCreateRoom(id);
  res.json({ id, expiresIn: ROOM_TTL });
});

export function formatUptime(seconds) {
  const sec = Math.floor(seconds);
  const mo = Math.floor(sec / (86400 * 30));
  const d = Math.floor((sec % (86400 * 30)) / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (mo > 0) return `${mo}mo, ${d} day`;
  if (d > 0) return `${d} day, ${h} hr`;
  if (h > 0) return `${h} hr, ${m} min`;
  if (m > 0) return `${m} min, ${s} sec`;
  return `${s} sec`;
}

app.get('/health', (req, res) => {
  const uptimeSec = process.uptime();
  const uptimeStr = formatUptime(uptimeSec);
  const host = req.headers.host || 'quick-file-share.onrender.com';
  const mem = process.memoryUsage();
  const memMb = (mem.rss / 1024 / 1024).toFixed(1);

  const acceptsHtml = req.accepts('html', 'json') === 'html';
  const wantsJson = req.query.format === 'json' || req.headers['content-type'] === 'application/json' || !acceptsHtml;

  if (wantsJson) {
    return res.status(200).json({
      status: 'ok',
      service: 'Quick File Share',
      host: `${host}/health`,
      uptime: uptimeSec,
      uptimeFormatted: `Up ${uptimeStr}`,
      memory: `${memMb} MB`,
      activeRooms: rooms.size,
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Health — ${host}</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0c1017;
      color: #e6edf3;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .status-card {
      background: #151b23;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 16px 20px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      overflow: hidden;
    }
    .status-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: #238636;
    }
    .indicator-icon {
      width: 32px;
      height: 32px;
      background: #238636;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 14px rgba(35, 134, 54, 0.5);
      animation: pulse 2.5s infinite ease-in-out;
    }
    .indicator-icon svg {
      width: 18px;
      height: 18px;
      color: #ffffff;
      stroke-width: 3;
    }
    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .endpoint-url {
      font-size: 1.05rem;
      font-weight: 700;
      color: #f0f6fc;
      letter-spacing: -0.2px;
      word-break: break-all;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .badge-http {
      background: rgba(110, 118, 129, 0.2);
      border: 1px solid rgba(110, 118, 129, 0.4);
      color: #8b949e;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 5px;
      letter-spacing: 0.5px;
    }
    .uptime-text {
      font-size: 0.86rem;
      color: #8b949e;
      font-weight: 500;
    }
    .uptime-val {
      color: #3fb950;
      font-weight: 600;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-top: 14px;
      width: 100%;
      max-width: 520px;
    }
    .stat-pill {
      background: #151b23;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }
    .stat-pill-label {
      font-size: 0.7rem;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .stat-pill-val {
      font-size: 0.88rem;
      font-weight: 600;
      color: #c9d1d9;
      font-family: 'JetBrains Mono', monospace;
    }
    .footer-links {
      margin-top: 20px;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .footer-links a {
      color: #58a6ff;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      transition: color 0.15s;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.08); opacity: 0.85; }
    }
  </style>
</head>
<body>
  <div class="status-card">
    <div class="indicator-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </div>
    <div class="content-area">
      <div class="endpoint-url">${host}/health</div>
      <div class="meta-row">
        <span class="badge-http">HTTP</span>
        <span class="uptime-text">Up <span class="uptime-val" id="uptimeCounter">${uptimeStr}</span></span>
      </div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-pill">
      <div class="stat-pill-label">Status</div>
      <div class="stat-pill-val" style="color: #3fb950;">200 OK</div>
    </div>
    <div class="stat-pill">
      <div class="stat-pill-label">Memory</div>
      <div class="stat-pill-val">${memMb} MB</div>
    </div>
    <div class="stat-pill">
      <div class="stat-pill-label">Active Rooms</div>
      <div class="stat-pill-val">${rooms.size}</div>
    </div>
  </div>

  <div class="footer-links">
    <a href="/">← Return to Quick File Share</a>
    <a href="/api/health?format=json">JSON API</a>
  </div>

  <script>
    let currentSec = ${Math.floor(uptimeSec)};
    function formatSecs(sec) {
      const mo = Math.floor(sec / (86400 * 30));
      const d = Math.floor((sec % (86400 * 30)) / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (mo > 0) return mo + 'mo, ' + d + ' day';
      if (d > 0) return d + ' day, ' + h + ' hr';
      if (h > 0) return h + ' hr, ' + m + ' min';
      if (m > 0) return m + ' min, ' + s + ' sec';
      return s + ' sec';
    }
    setInterval(() => {
      currentSec++;
      document.getElementById('uptimeCounter').textContent = formatSecs(currentSec);
    }, 1000);
  </script>
</body>
</html>`);
});

app.get('/api/health', (_req, res) => {
  const uptimeSec = process.uptime();
  res.json({
    status: 'ok',
    service: 'Quick File Share',
    uptime: uptimeSec,
    uptimeFormatted: `Up ${formatUptime(uptimeSec)}`,
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// HTTP Signaling Endpoints (For Vercel Serverless & WebSocket Fallback)
app.post('/api/signal/join', (req, res) => {
  const { roomId, role } = req.body || {};
  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  const room = getOrCreateRoom(roomId);
  const peerId = req.body.peerId || newPeerId();

  room.httpPeers.set(peerId, {
    role: role || 'peer',
    lastSeen: Date.now()
  });

  const totalPeers = (room.clients ? room.clients.size : 0) + room.httpPeers.size;
  const isInitiator = role === 'sender' || totalPeers === 1;

  // Broadcast peer-ready if we have 2+ peers
  if (totalPeers >= 2) {
    const readyMsg = {
      id: room.msgCounter++,
      from: peerId,
      data: { type: 'peer-ready', peerCount: totalPeers },
      timestamp: Date.now()
    };
    room.messages.push(readyMsg);

    // Also notify any WebSocket clients in the same room
    if (room.clients) {
      for (const client of room.clients) {
        if (client.readyState === 1) {
          try { client.send(JSON.stringify(readyMsg.data)); } catch (e) {}
        }
      }
    }
  }

  res.json({
    success: true,
    peerId,
    roomId,
    peerCount: totalPeers,
    isInitiator
  });
});

app.post('/api/signal/send', (req, res) => {
  const { roomId, peerId, message } = req.body || {};
  if (!roomId || !message) {
    return res.status(400).json({ error: 'roomId and message are required' });
  }

  const room = getOrCreateRoom(roomId);
  if (peerId && room.httpPeers.has(peerId)) {
    room.httpPeers.get(peerId).lastSeen = Date.now();
  }

  const msgEntry = {
    id: room.msgCounter++,
    from: peerId || 'anon',
    data: message,
    timestamp: Date.now()
  };

  room.messages.push(msgEntry);

  // Keep last 100 signaling messages
  if (room.messages.length > 100) {
    room.messages.splice(0, room.messages.length - 100);
  }

  // Also relay to any active WebSocket clients in this room
  if (room.clients) {
    for (const client of room.clients) {
      if (client.readyState === 1) {
        try { client.send(JSON.stringify(message)); } catch (e) {}
      }
    }
  }

  res.json({ success: true, messageId: msgEntry.id });
});

app.get('/api/signal/poll', (req, res) => {
  const roomId = String(req.query.roomId || '').trim();
  const peerId = String(req.query.peerId || '').trim();
  const since = parseInt(req.query.since || '0', 10);

  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  const room = getOrCreateRoom(roomId);
  if (peerId && room.httpPeers.has(peerId)) {
    room.httpPeers.get(peerId).lastSeen = Date.now();
  }

  const newMessages = room.messages
    .filter(m => m.id > since && m.from !== peerId)
    .map(m => ({ id: m.id, data: m.data }));

  const totalPeers = (room.clients ? room.clients.size : 0) + room.httpPeers.size;

  res.json({
    messages: newMessages,
    peerCount: totalPeers,
    lastMsgId: room.messages.length > 0 ? room.messages[room.messages.length - 1].id : since
  });
});

app.post('/api/signal/leave', (req, res) => {
  const { roomId, peerId } = req.body || {};
  if (roomId && rooms.has(roomId)) {
    const room = rooms.get(roomId);
    if (peerId) room.httpPeers.delete(peerId);

    const leaveMsg = {
      id: room.msgCounter++,
      from: peerId,
      data: { type: 'peer-left' },
      timestamp: Date.now()
    };
    room.messages.push(leaveMsg);

    if (room.clients) {
      for (const client of room.clients) {
        if (client.readyState === 1) {
          try { client.send(JSON.stringify({ type: 'peer-left' })); } catch (e) {}
        }
      }
    }
  }
  res.json({ success: true });
});

app.get('/contact', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/s/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export default app;
