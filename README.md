# ⚡ Quick File Send

> **Ultra-Fast, Resumable Multi-Gigabyte Peer-to-Peer File Transfer Web Application**  
> Powered by WebRTC DataChannels with automatic WebSocket Flow-Controlled Cloud Relay Fallback.

![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-indigo.svg)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Direct-blue.svg)
![Cross-Network](https://img.shields.io/badge/Cross--Network-Mobile%20%7C%20Wi--Fi%20%7C%20Cellular-cyan.svg)

---

## 🚀 Key Highlights & Features

- **🌐 Universal Cross-Network Streaming**: Works across different Wi-Fi networks, mobile cellular data (4G/5G CGNAT), and firewalls using STUN/TURN and automatic Cloud Relay fallback.
- **🛡️ Accidental Refresh Protection**: Traps `F5`, `Ctrl+R`, `Cmd+R`, and browser reload/close events with an interactive confirmation dialog so in-progress transfers are never lost.
- **⚡ Background Tab & Minimized Window Immunity**:
  - **Inline Web Worker Engine**: Prevents browser background timer clamping (`setInterval` throttling).
  - **Active AudioBuffer Keepalive**: Informs OS/Browser power management that media is active, preventing tab suspension/discarding.
  - **Screen Wake Lock API**: Prevents mobile and laptop displays from going to sleep while streaming.
- **🔄 Sliding-Window Flow Control (512 KB)**: Paces upload/download chunks to eliminate buffer overflow across cloud tunnels and mobile browsers.
- **💾 Zero-RAM Sliced Batching (8 MB Batches)**: Keeps browser RAM usage below 30MB even when receiving multi-gigabyte (2GB–10GB+) video files.
- **🔁 Instant 300ms Auto-Resume**: Seamlessly resumes from the exact byte offset if network transitions between Wi-Fi and mobile data.
- **🔒 Privacy & Zero-Knowledge**: No files or chunks are ever stored on the server disk. Data flows directly peer-to-peer or ephemeral memory stream relay.

---

## 📁 Project Architecture

```
quick-file-send/
├── .gitignore             # Strict exclusion of sensitive data, logs & modules
├── public/
│   └── index.html         # Frontend Single-Page App (Vanilla JS + Glassmorphic CSS)
├── package.json           # Node.js project configuration
├── server.js              # Express HTTP + WebSocket Relay Server
└── test-runner.js         # Automated end-to-end testing suite
```

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally
```bash
npm start
```

Access the app in your browser:
- **Local Access:** `http://localhost:3000`
- **LAN Access:** `http://<your-local-ip>:3000`

---

## 🌐 Public Sharing via Cloudflare Tunnel

To share across different internet connections (e.g. PC to remote phone):
```bash
cloudflared tunnel --url http://localhost:3000
```
Share the generated `https://*.trycloudflare.com` URL or scan the in-app QR code.

---

## 🧪 Automated Testing

Run the automated test runner to verify HTTP endpoints, WebRTC signaling, and WebSocket relays:
```bash
node test-runner.js
```

---

## 🔒 Security & Privacy Policy

- **Zero Server Storage**: Files are streamed in transit and never written to disk or logged.
- **Encrypted WebRTC**: End-to-end encrypted via DTLS/SRTP when direct P2P is established.
- **No Secrets or Tracking**: Zero third-party trackers, zero telemetry, zero analytics.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
