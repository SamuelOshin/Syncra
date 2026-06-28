# Deployment Guide: Syncra Enterprise

Syncra is a fullstack Node.js + Express application that utilizes **persistent WebSockets (Socket.io)** for real-time translation streaming and media signaling. 

Due to the WebSocket architecture, **serverless platforms like Vercel are not suitable** because serverless functions are stateless and terminate connections after a few seconds. Persistent WebSocket connections will fail to establish.

We recommend deploying to either **Railway** (e.g., staging/fast production) or a **VPS** (e.g., long-term cost-efficient hosting).

---

## 📊 Hosting Option Comparison

| Feature | 🚂 Railway (Recommended Staging) | 🖥️ VPS (DigitalOcean/Hetzner) | ⚡ Vercel |
| :--- | :--- | :--- | :--- |
| **Effort** | Zero-Ops (Git push to deploy) | Medium (Setup PM2/Docker, SSL, Nginx) | Low |
| **WebSockets** | ✅ Supported out of the box | ✅ Supported out of the box | ❌ **Unsupported** (Serverless) |
| **Database** | SQLite (with Volume) or Managed Postgres | SQLite (on SSD) or Postgres | Serverless DBs only |
| **SSL/HTTPS** | ✅ Automated | ✅ Manual (using Caddy/Certbot) | ✅ Automated |
| **Cost** | Usage-based (Free tier + paid) | Fixed (e.g., $4 - $6/month) | Free tier |

---

## 🚂 Option A: Deploying on Railway (Fastest & Easiest)

Railway is a modern PaaS that supports Dockerfiles and long-running Node.js processes.

### Step 1: Prepare the Repository
Ensure you have a `Dockerfile` in the root of your project. If you don't, Railway will automatically detect the `package.json` and build it using a Node.js Nixpack, but a Dockerfile guarantees environment consistency.
Here is a production-ready `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

### Step 2: Deploy on Railway
1.  Go to [Railway.app](https://railway.app) and sign in.
2.  Click **New Project** ➔ **Deploy from GitHub repo**.
3.  Select the `lingomeet` repository.
4.  Click **Deploy Now**.

### Step 3: Add Variables & Persistent Storage (For SQLite)
If you are using **SQLite** as the database:
1.  Go to the service **Settings** in Railway.
2.  Under **Volumes**, click **Add Volume** (size: 1GB to 5GB, mount path: `/app/data`).
3.  Go to **Variables** and add:
    *   `PORT` = `3000`
    *   `DATABASE_URL` = `/app/data/sqlite.db` (This ensures the SQLite file persists across deployments)
    *   `SESSION_SECRET` = `your-random-secure-string`

If you want to use **PostgreSQL**:
1.  Click **New** ➔ **Database** ➔ **Add PostgreSQL** in your Railway workspace.
2.  Railway will automatically inject the `DATABASE_URL` variable into your Node.js service.
3.  Add the environment variable `DB_PROVIDER` = `postgres` to your Node.js service.

---

## 🖥️ Option B: Deploying on a VPS (Hetzner / DigitalOcean)

A VPS is highly recommended for production because it is extremely cheap (fixed $4-$6/month) and has plenty of resources for hundreds of concurrent WebSocket connections.

We recommend using **PM2** (Process Manager) and **Caddy** (an extremely simple web server that automatically manages SSL certificates).

### Step 1: Server Setup
SSH into your VPS and install Node.js, Git, and Caddy:
```bash
# Install Node.js (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install PM2 globally
sudo npm install pm2 -g

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Step 2: Clone and Build the Application
```bash
cd /var/www
sudo git clone https://github.com/your-username/lingomeet.git syncra
cd syncra
sudo npm install
sudo npm run build
```

### Step 3: Configure PM2 (Process Manager)
Create an `ecosystem.config.json` in the `/var/www/syncra` folder:
```json
{
  "apps": [
    {
      "name": "syncra-production",
      "script": "dist/server.js",
      "instances": "max",
      "exec_mode": "cluster",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3000,
        "DATABASE_URL": "sqlite.db",
        "SESSION_SECRET": "your-super-secure-secret-key"
      }
    }
  ]
}
```
Start the application:
```bash
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

### Step 4: Configure Reverse Proxy & SSL (Caddy)
Caddy will automatically provision and renew your Let's Encrypt SSL certificates.
Edit the Caddyfile (`/etc/caddy/Caddyfile`):
```caddyfile
syncra.yourdomain.com {
    reverse_proxy localhost:3000
}
```
Restart Caddy to apply:
```bash
sudo systemctl restart caddy
```

Your app is now live with automatic HTTPS at `https://syncra.yourdomain.com`!
