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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), activeRooms: rooms.size });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), activeRooms: rooms.size });
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
