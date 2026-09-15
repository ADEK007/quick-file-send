import http from 'http';
import { WebSocketServer } from 'ws';
import { app, rooms, getLocalIp, getOrCreateRoom } from './app.js';

const server = http.createServer(app);

// WebSocket Server with high-throughput relay support
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 100 * 1024 * 1024 // 100MB chunk max
});

const PORT = process.env.PORT || 3000;

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
      if (room.clients) {
        for (const peer of room.clients) {
          if (peer !== ws && peer.readyState === 1) {
            try {
              peer.send(raw, { binary: true });
            } catch (e) {
              console.warn('Error relaying binary chunk:', e.message);
            }
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

      const room = getOrCreateRoom(roomId);

      // Clean up any closed/stale client sockets in this room
      for (const client of room.clients) {
        if (client.readyState !== 1) room.clients.delete(client);
      }

      // Seamless reconnect support: If 2 clients already exist and a reconnecting socket joins,
      // evict the oldest disconnected/stale client instead of blocking the user!
      if (room.clients.size >= 2 && !room.clients.has(ws)) {
        const clientArray = Array.from(room.clients);
        const oldClient = clientArray[clientArray.length - 1];
        room.clients.delete(oldClient);
      }

      room.clients.add(ws);
      const isInitiator = room.clients.size === 1 && (!room.httpPeers || room.httpPeers.size === 0);
      const totalPeers = room.clients.size + (room.httpPeers ? room.httpPeers.size : 0);

      ws.send(JSON.stringify({ type: 'joined', initiator: isInitiator, roomId, peerCount: totalPeers }));

      // Notify peer that someone is present & ready
      for (const peer of room.clients) {
        if (peer !== ws && peer.readyState === 1) {
          peer.send(JSON.stringify({ type: 'peer-ready', peerCount: totalPeers }));
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
    if (room.clients) {
      for (const peer of room.clients) {
        if (peer !== ws && peer.readyState === 1) {
          try {
            peer.send(JSON.stringify(msg));
          } catch (e) {}
        }
      }
    }
  });

  ws.on('close', () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.clients) {
        room.clients.delete(ws);
        for (const peer of room.clients) {
          if (peer.readyState === 1) {
            try {
              peer.send(JSON.stringify({ type: 'peer-left' }));
            } catch (e) {}
          }
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
  console.log(`⚡ Quick File Share is ACTIVE & READY TO USE!`);
  console.log(`   - Local Access:   http://localhost:${PORT}`);
  console.log(`   - Network Access: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
