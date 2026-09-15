# ⚡ Quick File Share

> **Ultra-Fast, Resumable Multi-Gigabyte Peer-to-Peer File Transfer Web Application**  
> Powered by WebRTC DataChannels with Dual Signaling (WebSocket + Serverless HTTP Fallback).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FADEK007%2Fquick-file-send)
![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-indigo.svg)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P%20Direct-blue.svg)
![Vercel Ready](https://img.shields.io/badge/Vercel-Serverless%20Ready-black.svg)
![Cross-Network](https://img.shields.io/badge/Cross--Network-Mobile%20%7C%20Wi--Fi%20%7C%20Cellular-cyan.svg)

---

## 🚀 Key Highlights & Features

- **🌐 100% Vercel Serverless Ready**: Full serverless configuration with `vercel.json` SPA rewrites, serverless function adapter (`api/index.js`), and HTTP signaling fallback.
- **⚡ Direct Peer-to-Peer (P2P) Transmission**: Data streams directly between peer browsers via WebRTC DataChannels using STUN/TURN relays at maximum line rate with zero server bandwidth load.
- **🔄 Dual-Mode Hybrid Signaling**: Automatically selects WebSockets on persistent Node servers (Render, Railway, VPS, Localhost) and seamlessly falls back to HTTP signaling on Vercel Serverless.
- **🛡️ Accidental Refresh Protection**: Traps `F5`, `Ctrl+R`, `Cmd+R`, and browser reload/close events with an interactive confirmation dialog so in-progress transfers are never lost.
- **📱 Mobile & Cross-Device Optimized**: Zero horizontal overflow, adaptive cards, responsive QR code generator, and touch-friendly controls.
- **⚡ Background Tab & Minimized Window Immunity**:
  - **Inline Web Worker Engine**: Prevents browser background timer clamping (`setInterval` throttling).
  - **Active AudioBuffer Keepalive**: Informs OS/Browser power management that media is active, preventing tab suspension/discarding.
  - **Screen Wake Lock API**: Prevents mobile and laptop displays from going to sleep while streaming.
- **🔄 Sliding-Window Flow Control (512 KB)**: Paces upload/download chunks to eliminate buffer overflow.
- **💾 Zero-RAM Sliced Batching (8 MB Batches)**: Keeps browser RAM usage below 30MB even when receiving multi-gigabyte (2GB–10GB+) files.
- **🔁 Instant 300ms Auto-Resume**: Seamlessly resumes from the exact byte offset if network transitions between Wi-Fi and mobile data.
- **🔒 Privacy & Zero-Knowledge**: No files or chunks are ever stored on server disks.

---

## 📁 Project Structure

```
quick-file-send/
├── .gitignore             # Strict exclusion of sensitive data, logs & modules
├── vercel.json            # Vercel serverless routing, SPA rewrites & security headers
├── api/
│   └── index.js           # Vercel Serverless Function entrypoint
├── public/
│   ├── index.html         # Glassmorphic Single-Page Application (HTML + CSS + JS)
│   ├── logo.png           # Brand logo asset
│   └── favicon.png        # Brand favicon asset
├── app.js                 # Shared Express application & HTTP signaling endpoints
├── server.js              # Standalone Node.js HTTP + WebSocket server
├── package.json           # Node.js project configuration
└── test-runner.js         # Automated end-to-end test suite
```

---

## ☁️ Deploying to Vercel (Production)

### Method 1: Deploy via Vercel Dashboard (Easiest)
1. Push your code to your GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository (`quick-file-send` / `quick-file-share`).
4. Click **Deploy**. Vercel will automatically detect `vercel.json` and `api/index.js`!

### Method 2: Deploy via Vercel CLI
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy to production
vercel --prod
```

---

## 🛠️ Local Development

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 2. Install & Run
```bash
# Install dependencies
npm install

# Start local server
npm start
```

Access the app in your browser:
- **Local Access:** `http://localhost:3000`
- **LAN Access:** `http://<your-local-ip>:3000`

---

## 🧪 Automated Testing

Run the automated test runner to verify HTTP endpoints, serverless adapter, WebRTC signaling, and WebSocket relays:
```bash
npm test
```

---

## 🔒 Security & Privacy Policy

- **Zero Server Storage**: Files are streamed in transit and never written to disk or logged.
- **Encrypted WebRTC**: End-to-end encrypted via DTLS/SRTP when direct P2P is established.
- **No Secrets or Tracking**: Zero third-party trackers, zero telemetry, zero analytics.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
