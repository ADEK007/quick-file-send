# 🚀 GitHub Setup & Production Deployment Guide

This guide provides step-by-step instructions on pushing **Quick File Share** to GitHub securely, setting up CI/CD, and deploying the application to production hosting platforms including **Vercel**, **Render**, **Railway**, and **VPS**.

---

## 📌 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Security & Privacy Pre-flight Check](#2-security--privacy-pre-flight-check)
3. [Pushing to GitHub (Step-by-Step)](#3-pushing-to-github-step-by-step)
4. [Production Cloud Deployment](#4-production-cloud-deployment)
   - [Option A: Vercel (Serverless — Recommended)](#option-a-vercel-serverless--recommended)
   - [Option B: Render / Railway / Fly.io (PaaS with WebSockets)](#option-b-render--railway--flyio-paas-with-websockets)
   - [Option C: Free Cloudflare Quick Tunnel](#option-c-free-cloudflare-quick-tunnel)
   - [Option D: Ubuntu VPS (DigitalOcean / AWS EC2)](#option-d-ubuntu-vps-digitalocean--aws-ec2)
5. [Git Security & Troubleshooting](#5-git-security--troubleshooting)

---

## 1. Prerequisites

- **Git** installed on your system: `git --version`
- A **GitHub Account**: [github.com](https://github.com)
- **Node.js** (v18.0.0 or higher) & **npm**

---

## 2. Security & Privacy Pre-flight Check

Before publishing to a public repository, ensure no sensitive data is leaked:

- ✅ **`node_modules/` is excluded**: Dependencies are excluded by `.gitignore`.
- ✅ **`.env` and secrets are ignored**: Private keys or tokens are excluded by `.gitignore`.
- ✅ **Zero storage policy**: The codebase does not persist user files to server disk.
- ✅ **License included**: Standard open-source MIT License is included.

---

## 3. Pushing to GitHub (Step-by-Step)

### Step 1: Create a New Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new).
2. Set **Repository name**: `quick-file-share` (or `quick-file-send`).
3. Set visibility to **Public** or **Private**.
4. ⚠️ **Do NOT check** "Add a README file", "Add .gitignore", or "Choose a license" (we already have these prepared locally).
5. Click **Create repository**.

### Step 2: Link and Push Local Code to GitHub
Open your terminal inside the project directory and run:

```bash
# 1. Check git status
git status

# 2. Stage all updated files
git add .

# 3. Commit changes
git commit -m "feat: add Vercel serverless production readiness, HTTP signaling, and branding"

# 4. Link remote (replace with your username/repo)
git remote add origin https://github.com/username/repo-name.git

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

---

## 4. Production Cloud Deployment

### Option A: Vercel (Serverless — Recommended)

Quick File Share is pre-configured with `vercel.json`, `api/index.js`, and an HTTP signaling fallback for serverless WebRTC negotiation.

#### Deploy via Web Dashboard:
1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository.
4. Keep the default settings (Framework Preset: **Other**, Root Directory: `./`).
5. Click **Deploy**.
6. Your site will be live at `https://your-project.vercel.app`!

#### Deploy via Vercel CLI:
```bash
# Install CLI
npm install -g vercel

# Deploy directly
vercel --prod
```

---

### Option B: Render / Railway / Fly.io (PaaS with WebSockets)

For deployments that utilize persistent WebSocket connections and high-bandwidth binary relay:

#### Deploying on Render (Free Tier):
1. Create an account on [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**.

#### Deploying on Railway:
1. Open [railway.app](https://railway.app) and click **New Project**.
2. Select **Deploy from GitHub repo**.
3. Select your repository and click Deploy.

---

### Option C: Free Cloudflare Quick Tunnel

Run your server locally or on any server, and expose it through Cloudflare's edge network:
```bash
# Start server
node server.js

# In another terminal window, start tunnel:
cloudflared tunnel --url http://localhost:3000
```

---

### Option D: Ubuntu VPS (DigitalOcean / Linode / AWS EC2)

1. **Clone repository on VPS:**
   ```bash
   git clone https://github.com/username/quick-file-share.git
   cd quick-file-share
   npm install --production
   ```

2. **Run as a system background service (PM2):**
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "quick-file-share"
   pm2 startup
   pm2 save
   ```

3. **Configure Nginx Reverse Proxy with SSL (Certbot):**
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Install SSL certificate:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 5. Git Security & Troubleshooting

### If Git asks for credentials:
Use a **GitHub Personal Access Token (Classic)** instead of your password:
1. Go to **GitHub Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)**.
2. Generate a token with `repo` permissions.
3. Use your GitHub username and the generated token as the password when prompted.
