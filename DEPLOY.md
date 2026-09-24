# Coolify Deployment Guide — Freelancer CRM

This guide walks you through deploying your **Freelancer CRM** to a self-hosted [Coolify](https://coolify.io) instance (v4) with automatic SSL certificates, zero-downtime updates, and minimal server resource consumption.

---

## 1. Architecture Overview

This application uses a **Unified Next.js Full-Stack Architecture**:

```
                       Internet
                          │
                          ▼
            ┌───────────────────────────┐
            │   Traefik (Coolify Proxy)  │
            │   • Automatic Let's Encrypt │
            │   • HTTPS / Port 443      │
            └─────────────┬─────────────┘
                          │ (Reverse proxy to :3000)
                          ▼
            ┌───────────────────────────┐
            │   Next.js Standalone App   │
            │   (Node.js 20 Alpine)     │
            │   • Frontend UI (React 19)│
            │   • API Routes & Actions  │
            │   • Healthcheck: /api/health
            └─────────────┬─────────────┘
                          │ (Internal Docker network)
                          ▼
            ┌───────────────────────────┐
            │   Database Layer          │
            │   • Coolify PostgreSQL    │
            │     OR Persistent SQLite   │
            └───────────────────────────┘
```

### Why Unified Full-Stack?
- **Zero Cross-Service Latency**: Server Actions and API endpoints execute within the same process.
- **Ultra-Lean Resource Usage**: A single standalone Alpine container requires only ~120–160 MB RAM.
- **No CORS Overhead**: Same-origin cookies and requests eliminate cross-domain configuration.

---

## 2. Prerequisites

1. **VPS with Coolify v4 installed**:
   - Any Linux VPS (Hetzner, DigitalOcean, OVH, Linode, AWS Lightsail).
   - Minimal hardware requirement: 1 vCPU, 1 GB–2 GB RAM, 20 GB SSD.
2. **Domain Name**:
   - An `A` or `CNAME` DNS record pointing to your Coolify VPS IP address (e.g. `crm.yourdomain.com`).
3. **GitHub Account**:
   - Push this repository to your GitHub account (`https://github.com/Olinkkt/freelancer-crm.git`).

---

## 3. Step-by-Step Coolify Deployment

### Step 1: Create a New Project & Resource in Coolify
1. Log into your Coolify Dashboard.
2. Select **Projects** -> click **+ Add Resource** -> select **Public Repository** or **Private Repository (GitHub App)**.
3. Paste your repository URL:
   ```
   https://github.com/Olinkkt/freelancer-crm
   ```
4. Choose branch: `main`.

### Step 2: Configure Build Pack
1. Under **Build Pack**, select: **Dockerfile** (recommended over Nixpacks).
   - *Why?* The repository includes an optimized multi-stage [Dockerfile](file:///home/oliver/Code/Projects/freelancercrm/Dockerfile) with Next.js `standalone` output, yielding an image size of only ~140 MB.
2. Ensure **Base Directory** is set to `/`.
3. Set **Dockerfile Location** to `/Dockerfile`.

### Step 3: Domain & Network Configuration
1. In the **General** settings tab, set your **Domains**:
   ```
   https://crm.yourdomain.com
   ```
2. Set **Port Exposes**: `3000`.
3. Coolify's Traefik reverse proxy will automatically:
   - Route incoming HTTPS requests on port 443 to internal container port 3000.
   - Request and renew Let's Encrypt SSL certificates automatically.
   - Redirect all HTTP requests to HTTPS.

### Step 4: Environment Variables
Go to the **Environment Variables** tab in your Coolify application and add:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables optimized production builds |
| `PORT` | `3000` | Port container listens on |
| `HOSTNAME` | `0.0.0.0` | **Crucial:** Binds to all network interfaces for Traefik routing |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables telemetry pings |
| `DATABASE_URL` | *(Optional, see Section 4)* | Connection string for database |
| `AUTH_SECRET` | *(Random 32-char hex string)* | Secret for single-operator access gate |

### Step 5: Health Check Configuration
In the **Healthcheck** settings:
- **Path**: `/api/health`
- **Port**: `3000`
- **Interval**: `30` seconds
- **Timeout**: `5` seconds
- **Retries**: `3`

This endpoint returns HTTP 200 `{ status: "healthy" }` and enables zero-downtime rolling deploys.

### Step 6: Deploy
Click **Deploy** in the top right. Coolify will:
1. Clone the repo.
2. Execute the multi-stage Docker build.
3. Start the container and verify the `/api/health` check.
4. Route your domain through Traefik with active SSL.

---

## 4. Database Setup & Persistence Options

### Option A: Coolify Managed PostgreSQL (Recommended for Growth)
1. In Coolify, navigate to your project -> click **+ Add Resource** -> **Database** -> **PostgreSQL**.
2. Name it (e.g., `freelancer-crm-db`).
3. Under **Database Settings**, copy the internal database URL provided by Coolify:
   ```
   postgresql://postgres:password@freelancer-crm-db:5432/crm?schema=public
   ```
4. Paste this value into your application's `DATABASE_URL` environment variable.
5. In Coolify, enable **Backups**:
   - Choose a daily cron schedule (`0 3 * * *` — 3:00 AM daily).
   - Set retention to 7 or 14 days (can save to local disk or S3/MinIO bucket).

---

### Option B: Embedded SQLite with Persistent Volume (Simplest Solo Setup)
If you prefer not running a separate database container:
1. In your Coolify application settings, go to **Storages / Persistent Volumes**.
2. Add a new mount:
   - **Source**: Named volume or host path (e.g. `crm-data`).
   - **Destination**: `/app/data`.
3. Set your environment variable:
   ```
   DATABASE_URL="file:/app/data/crm.db"
   ```
4. All database files in `/app/data` will persist across container rebuilds and updates.

---

## 5. Security & Single-Operator Protection

Because this CRM stores private client information, contract pricing (`Kč`), and meeting notes, it must not be left unprotected on the open web.

### Method 1: Traefik Basic Auth (1-Click in Coolify)
1. Go to your Application in Coolify -> **Advanced** / **Middlewares** tab.
2. Under Traefik middlewares, add **Basic Auth**:
   - Format: `username:htpasswd_hash` (generate hash via `htpasswd -nb username password`).
3. Traefik will prompt for credentials before any request even touches the Next.js container.

### Method 2: Application-Level Auth Gate
When integrating authentication in Phase 2:
- Add an `AUTH_SECRET` environment variable.
- Implement a single-password screen or passkey gate that sets an HTTP-only session cookie.

---

## 6. Maintenance & Day-to-Day Operations

### Automatic Deployments on Git Push
1. In Coolify, navigate to **Webhooks**.
2. Copy the **Deploy Webhook** URL.
3. In your GitHub repository -> **Settings** -> **Webhooks**:
   - Add the Coolify webhook URL.
   - Content type: `application/json`.
   - Event: `Just the push event`.
4. Every time you push to `main`, Coolify automatically builds and updates your live instance with zero downtime.

### Viewing Logs
- In Coolify, open your application and click the **Logs** tab.
- Live stdout/stderr from `node server.js` will stream in real time.

### Rollbacks
- Coolify keeps previous image versions. If an update introduces an unexpected issue, click **Deployments** -> select the last successful deployment -> click **Rollback**.

---

## 7. Verification Checklist

Before using your CRM in production, verify:
- [ ] Domain resolves over HTTPS with a valid Let's Encrypt certificate.
- [ ] `https://crm.yourdomain.com/api/health` returns HTTP 200 `{ "status": "healthy" }`.
- [ ] Command palette (`Cmd+K`) and keyboard shortcuts (`N`, `C`, `L`) function smoothly.
- [ ] Basic Auth or application security gate is active.
- [ ] Database backup schedule is active in Coolify.
