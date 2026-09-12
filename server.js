import express from 'express';
import http from 'http';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// WebSocket Server with high-throughput relay support
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 100 * 1024 * 1024 // 100MB chunk max
});

const rooms = new Map();
const PORT = process.env.PORT || 3000;
const ROOM_TTL = 3 * 60 * 60 * 1000; // 3 hours

function newId() {
  return crypto.randomBytes(4).toString('hex');
}

function getLocalIp() {
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

// Clean up expired rooms
function cleanRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    // Purge dead clients
    for (const client of room.clients) {
      if (client.readyState !== 1) room.clients.delete(client);
    }
    if (now - room.createdAt > ROOM_TTL || (room.clients.size === 0 && now - room.createdAt > 900_000)) {
      rooms.delete(id);
    }
  }
}
setInterval(cleanRooms, 30_000).unref();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/info', (_req, res) => {
  const localIp = getLocalIp();
  res.json({
    status: 'ok',
    localIp,
    port: PORT,
    localUrl: `http://${localIp}:${PORT}`,
    activeRooms: rooms.size
  });
});

app.get('/api/room', (_req, res) => {
  let id = newId();
  while (rooms.has(id)) id = newId();
  rooms.set(id, { createdAt: Date.now(), clients: new Set() });
  res.json({ id, expiresIn: ROOM_TTL });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), activeRooms: rooms.size });
});

app.get('/s/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket Signaling & Cross-Network Relay
wss.on('connection', (ws) => {
  let roomId = null;
  ws.isAlive = true;
  ws.lastActive = Date.now();

  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastActive = Date.now();
  });

  ws.on('message', (raw, isBinary) => {
    ws.isAlive = true;
    ws.lastActive = Date.now();

    // 1. Binary Stream Relay
    if (isBinary) {
      if (!roomId || !rooms.has(roomId)) return;
      const room = rooms.get(roomId);
      for (const peer of room.clients) {
        if (peer !== ws && peer.readyState === 1) {
          try {
            peer.send(raw, { binary: true });
          } catch (e) {
            console.warn('Error relaying binary chunk:', e.message);
          }
        }
      }
      return;
    }

    // 2. Control / Signaling JSON
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      roomId = String(msg.roomId || '').trim();
      if (!roomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid room ID.' }));
        return;
      }

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { createdAt: Date.now(), clients: new Set() });
      }

      const room = rooms.get(roomId);

      // Clean up any closed/stale client sockets in this room
      for (const client of room.clients) {
        if (client.readyState !== 1) room.clients.delete(client);
      }

      // Seamless reconnect support: If 2 clients already exist and a reconnecting socket joins,
      // evict the oldest disconnected/stale client instead of blocking the user!
      if (room.clients.size >= 2 && !room.clients.has(ws)) {
        const clientArray = Array.from(room.clients);
        // Evict the first client to make space for the reconnecting peer
        const oldClient = clientArray[clientArray.length - 1];
        room.clients.delete(oldClient);
      }

      room.clients.add(ws);
      const isInitiator = room.clients.size === 1;
      ws.send(JSON.stringify({ type: 'joined', initiator: isInitiator, roomId }));

      // Notify peer that someone is present & ready
      for (const peer of room.clients) {
        if (peer !== ws && peer.readyState === 1) {
          peer.send(JSON.stringify({ type: 'peer-ready', peerCount: room.clients.size }));
        }
      }
      return;
    }

    if (msg.type === 'ping') {
      ws.isAlive = true;
      ws.lastActive = Date.now();
      try {
        ws.send(JSON.stringify({ type: 'pong' }));
      } catch (e) {}
      return;
    }

    if (!roomId || !rooms.has(roomId)) return;

    // Relay all signaling & control messages between peers
    const room = rooms.get(roomId);
    for (const peer of room.clients) {
      if (peer !== ws && peer.readyState === 1) {
        try {
          peer.send(JSON.stringify(msg));
        } catch (e) {}
      }
    }
  });

  ws.on('close', () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.clients.delete(ws);
      for (const peer of room.clients) {
        if (peer.readyState === 1) {
          try {
            peer.send(JSON.stringify({ type: 'peer-left' }));
          } catch (e) {}
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('WebSocket client error:', err.message);
  });
});

// Resilient background heartbeat (60s grace, resets on ANY message or ping)
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false && (now - (ws.lastActive || 0)) > 60_000) {
      console.log('Pruning inactive WebSocket client');
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
}, 25_000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`⚡ Quick File Send is ACTIVE & READY TO USE!`);
  console.log(`   - Local Access:   http://localhost:${PORT}`);
  console.log(`   - Network Access: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
