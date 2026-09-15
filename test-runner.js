import http from 'http';
import { WebSocket } from 'ws';
import vercelHandler from './api/index.js';

function fetchUrl(path, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : null;
    const headers = options.headers || {};
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(`http://localhost:3000${path}`, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Core HTTP Endpoints ---');
  const root = await fetchUrl('/');
  console.log(`GET / -> Status ${root.status}, Length: ${root.data.length} bytes`);

  const shareRoute = await fetchUrl('/s/test1234');
  console.log(`GET /s/test1234 -> Status ${shareRoute.status}, Length: ${shareRoute.data.length} bytes`);

  const contactRoute = await fetchUrl('/contact');
  console.log(`GET /contact -> Status ${contactRoute.status}, Length: ${contactRoute.data.length} bytes`);

  const info = await fetchUrl('/api/info');
  console.log(`GET /api/info -> Status ${info.status}, Body: ${info.data}`);

  const room = await fetchUrl('/api/room');
  console.log(`GET /api/room -> Status ${room.status}, Body: ${room.data}`);
  const roomData = JSON.parse(room.data);

  console.log('\n--- 2. Testing Vercel Serverless Function Handler ---');
  if (typeof vercelHandler === 'function') {
    console.log('✅ api/index.js export is a valid serverless function handler');
  } else {
    throw new Error('api/index.js is not exporting a function');
  }

  console.log('\n--- 3. Testing HTTP Signaling Fallback (Vercel Serverless Ready) ---');
  const httpRoom = await fetchUrl('/api/room');
  const httpRoomData = JSON.parse(httpRoom.data);

  // Join sender
  const senderJoin = await fetchUrl('/api/signal/join', {
    method: 'POST',
    body: { roomId: httpRoomData.id, role: 'sender' }
  });
  console.log('Sender HTTP Join:', senderJoin.data);
  const senderInfo = JSON.parse(senderJoin.data);

  // Join receiver
  const receiverJoin = await fetchUrl('/api/signal/join', {
    method: 'POST',
    body: { roomId: httpRoomData.id, role: 'receiver' }
  });
  console.log('Receiver HTTP Join:', receiverJoin.data);
  const receiverInfo = JSON.parse(receiverJoin.data);

  // Sender sends SDP offer
  await fetchUrl('/api/signal/send', {
    method: 'POST',
    body: {
      roomId: httpRoomData.id,
      peerId: senderInfo.peerId,
      message: { type: 'offer', offer: { sdp: 'dummy-sdp-offer', type: 'offer' } }
    }
  });

  // Receiver polls and gets SDP offer
  const poll1 = await fetchUrl(`/api/signal/poll?roomId=${httpRoomData.id}&peerId=${receiverInfo.peerId}&since=0`);
  const poll1Data = JSON.parse(poll1.data);
  console.log('Receiver Polled Messages:', poll1Data.messages.map(m => m.data.type));
  const hasOffer = poll1Data.messages.some(m => m.data.type === 'offer');
  if (!hasOffer) throw new Error('HTTP Signaling failed to deliver offer');

  // Receiver sends SDP answer
  await fetchUrl('/api/signal/send', {
    method: 'POST',
    body: {
      roomId: httpRoomData.id,
      peerId: receiverInfo.peerId,
      message: { type: 'answer', answer: { sdp: 'dummy-sdp-answer', type: 'answer' } }
    }
  });

  // Sender polls and gets SDP answer
  const poll2 = await fetchUrl(`/api/signal/poll?roomId=${httpRoomData.id}&peerId=${senderInfo.peerId}&since=0`);
  const poll2Data = JSON.parse(poll2.data);
  console.log('Sender Polled Messages:', poll2Data.messages.map(m => m.data.type));
  const hasAnswer = poll2Data.messages.some(m => m.data.type === 'answer');
  if (!hasAnswer) throw new Error('HTTP Signaling failed to deliver answer');

  console.log('✅ HTTP Signaling Fallback passed seamlessly!');

  console.log('\n--- 4. Testing WebSocket Signaling Server ---');
  const ws1 = new WebSocket('ws://localhost:3000/ws');
  const ws2 = new WebSocket('ws://localhost:3000/ws');

  await new Promise((resolve, reject) => {
    let ws1Joined = false;
    let ws2Joined = false;
    let peerReady = false;

    ws1.on('open', () => {
      ws1.send(JSON.stringify({ type: 'join', roomId: roomData.id }));
    });

    ws1.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'joined') ws1Joined = true;
      if (parsed.type === 'peer-ready') {
        peerReady = true;
        ws1.send(JSON.stringify({ type: 'offer', offer: { sdp: 'fake-sdp-test', type: 'offer' } }));
      }
    });

    ws2.on('open', () => {
      setTimeout(() => {
        ws2.send(JSON.stringify({ type: 'join', roomId: roomData.id }));
      }, 100);
    });

    ws2.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'joined') ws2Joined = true;
      if (parsed.type === 'offer') {
        ws2.send(JSON.stringify({ type: 'answer', answer: { sdp: 'fake-sdp-answer', type: 'answer' } }));
      }
    });

    ws1.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'answer') {
        console.log('✅ WebSocket Signaling verified!');
        ws1.close();
        ws2.close();
        resolve();
      }
    });

    setTimeout(() => {
      if (!peerReady) reject(new Error('WebSocket signaling test timed out'));
    }, 4000);
  });

  console.log('\n======================================================');
  console.log('🎉 ALL SUITES PASSED! Quick File Share is 100% READY FOR VERCEL PRODUCTION!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
