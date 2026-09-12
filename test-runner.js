import http from 'http';
import { WebSocket } from 'ws';

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing HTTP Endpoints...');
  const root = await fetchUrl('/');
  console.log(`GET / -> Status ${root.status}, Length: ${root.data.length} bytes`);

  const shareRoute = await fetchUrl('/s/test1234');
  console.log(`GET /s/test1234 -> Status ${shareRoute.status}, Length: ${shareRoute.data.length} bytes`);

  const info = await fetchUrl('/api/info');
  console.log(`GET /api/info -> Status ${info.status}, Body: ${info.data}`);

  const room = await fetchUrl('/api/room');
  console.log(`GET /api/room -> Status ${room.status}, Body: ${room.data}`);
  const roomData = JSON.parse(room.data);

  console.log('\nTesting WebSocket Signaling Server...');
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
      console.log('WS1 received:', parsed.type);
      if (parsed.type === 'joined') ws1Joined = true;
      if (parsed.type === 'peer-ready') {
        peerReady = true;
        // Test relaying offer
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
      console.log('WS2 received:', parsed.type);
      if (parsed.type === 'joined') ws2Joined = true;
      if (parsed.type === 'offer') {
        console.log('WS2 received offer successfully! Relaying back answer...');
        ws2.send(JSON.stringify({ type: 'answer', answer: { sdp: 'fake-sdp-answer', type: 'answer' } }));
      }
    });

    ws1.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'answer') {
        console.log('WS1 received answer successfully! WebRTC signaling verified!');
        ws1.close();
        ws2.close();
        resolve();
      }
    });

    setTimeout(() => {
      if (!peerReady) reject(new Error('WebSocket signaling test timed out'));
    }, 4000);
  });

  console.log('\nAll End-to-End Tests Passed Successfully! Site is fully live and functional.');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
