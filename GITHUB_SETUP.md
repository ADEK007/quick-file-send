# 🚀 GitHub Setup & Deployment Guide

This guide provides step-by-step instructions on pushing **Quick File Send** to GitHub securely, setting up CI/CD, and deploying the application to production hosting platforms.

---

## 📌 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Security & Privacy Pre-flight Check](#2-security--privacy-pre-flight-check)
3. [Pushing to GitHub (Step-by-Step)](#3-pushing-to-github-step-by-step)
4. [Production Cloud Deployment](#4-production-cloud-deployment)
   - [Option A: Free Cloudflare Quick Tunnel](#option-a-free-cloudflare-quick-tunnel)
   - [Option B: Render / Railway / Fly.io (PaaS)](#option-b-render--railway--flyio-paas)
   - [Option C: Ubuntu VPS (DigitalOcean / Linode / AWS EC2)](#option-c-ubuntu-vps-digitalocean--linode--aws-ec2)
5. [Git Security & Troubleshooting](#5-git-security--troubleshooting)

---

## 1. Prerequisites

- **Git** installed on your system: `git --version`
- A **GitHub Account**: [github.com](https://github.com)
- **Node.js** (v18.0.0 or higher) & **npm**

---

## 2. Security & Privacy Pre-flight Check

Before publishing to a public repository, ensure no sensitive data is leaked:

- ✅ **`node_modules/` is excluded**: Dependencies should never be committed.
- ✅ **`.env` and secrets are ignored**: Private keys, certificates, or tokens are excluded by `.gitignore`.
- ✅ **Zero storage policy**: The codebase does not persist user files to server disk.
- ✅ **License included**: Standard open-source MIT License is included.

---

## 3. Pushing to GitHub (Step-by-Step)

### Step 1: Create a New Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new).
2. Set **Repository name**: `quick-file-send`.
3. Set visibility to **Public** or **Private**.
4. ⚠️ **Do NOT check** "Add a README file", "Add .gitignore", or "Choose a license" (we already have these prepared locally).
5. Click **Create repository**.

### Step 2: Link and Push Local Code to GitHub
Open your terminal inside the project directory and run:

```bash
# 1. Add the GitHub remote (replace with your username/repo)
git remote add origin https://github.com/ADEK007/quick-file-send.git

# 2. Ensure main branch
git branch -M main

# 3. Push to GitHub
git push -u origin main
```

---

## 4. Production Cloud Deployment

### Option A: Free Cloudflare Quick Tunnel (Easiest)
Run your server locally or on any server, and expose it through Cloudflare's edge network:
```bash
# Start server
node server.js

# In another terminal window, start tunnel:
cloudflared tunnel --url http://localhost:3000
```
This gives you an instant, secure `https://*.trycloudflare.com` URL with free SSL and global CDN edge routing.

---

### Option B: Render / Railway / Fly.io (PaaS)

#### Deploying on Render (Free Tier):
1. Create an account on [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository `quick-file-send`.
4. Configure settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Click **Create Web Service**.

#### Deploying on Railway:
1. Open [railway.app](https://railway.app) and click **New Project**.
2. Select **Deploy from GitHub repo**.
3. Choose `quick-file-send` and deploy!

---

### Option C: Ubuntu VPS (DigitalOcean / Linode / AWS EC2)

1. **Clone repository on VPS:**
   ```bash
   git clone https://github.com/AEDK007/quick-file-send.git
   cd quick-file-send
   npm install --production
   ```

2. **Run as a system background service (PM2):**
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "quick-file-send"
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

### Verifying Git Status:
```bash
git status
git log --oneline
```
