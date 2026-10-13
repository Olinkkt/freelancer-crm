# Freelancer CRM ⚡

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](./LICENSE)
[![CI Status](https://github.com/Olinkkt/freelancer-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/Olinkkt/freelancer-crm/actions)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](./docker-compose.yml)

A minimal, keyboard-driven, local-first CRM built specifically for solo developers, designers, and freelance contractors.

Unlike enterprise CRMs (HubSpot, Salesforce) designed for large sales teams with endless form fields, **Freelancer CRM** is built around how solo operators actually work and get paid: **Quick Capture $\rightarrow$ Discovery $\rightarrow$ Deposit $\rightarrow$ Sprint Milestones $\rightarrow$ Final Handover $\rightarrow$ Retainer / Testimonial Follow-up**.

---

## ⚡ Highlights

- **Linear / Superhuman Keyboard Velocity**:
  - `N` — Quick capture new deals in under 5 seconds.
  - `L` — Log discovery calls with slash templates (`/call`, `/meeting`, `/pricing`, `/tech`).
  - `O` — Jump directly into full-screen **Project Workspace** (`/deals/[id]`).
  - `C` — Add client contacts.
  - `Cmd / Ctrl + K` — Command palette and fuzzy navigation.
  - `G D`, `G C`, `G U`, `G K`, `G A`, `G S` — Instant view jumping.
  - `H / J / K / L` or Arrow keys — Vim-style board navigation.
- **Dedicated Project Execution Cockpit (`/deals/[id]`)**:
  - Progressive disclosure: use the fast Kanban drawer for triage, press `O` for deep project execution.
  - 100% horizontal real estate for milestone checklists, scratchpad specs, and invoicing.
  - One-click syncing of action items (`- [ ]`) from notes into GTD follow-ups.
- **The Freelancer 50/50 Payment Rule**:
  - Automatically splits project quotes into **50% Upfront Deposit** and **50% Final Handover** invoices.
  - Receiving the deposit automatically shifts the deal into **Won • Active Work**.
  - Collecting final payment moves the deal into **Paid • Delivered**.
  - One-click copy for invoice payment links and QR code targets.
  - Collecting final payment moves the deal into **Paid • Delivered**.
  - One-click copy for invoice payment links and QR code targets.
- **Milestone & Scope Templates**:
  - 1-click presets: `+ Web Build (4 milestones)`, `+ Brand & Identity (3)`, `+ Monthly Retainer (3)`.
  - Client sign-off toggles and progress tracking visible directly on Kanban cards.
- **Post-Delivery Momentum**:
  - High-leverage 1-click reminders on finished projects (*"Request Testimonial in 3 days"*, *"Pitch Monthly Retainer in 14 days"*) to eliminate revenue feast-or-famine cycles.
- **Local-First & Privacy-Focused**:
  - Powered by Kysely + LibSQL / SQLite or PostgreSQL.
  - Zero third-party telemetry, self-hostable with Docker or Coolify in minutes.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions, React 19)
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Database**: Kysely with `@libsql/client` (SQLite) or `pg` (PostgreSQL)
- **Testing**: Node.js Native Test Runner (`tsx`) & Playwright CLI

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Olinkkt/freelancer-crm.git
cd freelancer-crm
pnpm install
```

### 2. Configure Environment

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Key environment variables:
```env
# Optional: Set a secret to lock your CRM behind an operator passcode gate
AUTH_SECRET=your-secure-passcode

# Database: Defaults to local SQLite file if omitted
DATABASE_URL=file:./data/freelancercrm.db

# Operator Identity
NEXT_PUBLIC_OPERATOR_NAME="Your Name"
NEXT_PUBLIC_OPERATOR_EMAIL="you@domain.com"
NEXT_PUBLIC_OPERATOR_ROLE="Full-Stack Engineer"

# Currency & Regional Settings (e.g. USD / $, EUR / €, CZK / Kč)
NEXT_PUBLIC_DEFAULT_CURRENCY="USD"
NEXT_PUBLIC_CURRENCY_SYMBOL="$"
NEXT_PUBLIC_LOCALE="en-US"
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Tests

```bash
pnpm test
```

---

## 🐳 Self-Hosting & Deployment

### Quick Docker Compose (1-Line Start)

Run the entire CRM locally or on any Linux VPS with persistent SQLite storage:

```bash
docker compose up -d
```
Access at [http://localhost:3000](http://localhost:3000) with automatic healthchecks and persistent database volume at `/app/data`.

### Zero-Downtime Deployment with Coolify
Check out [`DEPLOY.md`](./DEPLOY.md) for a complete zero-downtime deployment guide using **Docker** and **Coolify v4** with automatic Let's Encrypt SSL.

---

## 📜 License & Open Source FAQ

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.

### FAQ for Freelancers & Developers:
- **Can I self-host this for my own freelance business for free?**
  **Yes!** You have complete freedom to self-host, modify, and use this software to manage your clients and freelance revenue without paying any licensing fees.
- **Can I fork and adapt it for my private workflow?**
  **Yes.** Private modifications for your own personal use do not require distribution.
- **Why AGPL-3.0 instead of MIT?**
  AGPL-3.0 prevents commercial entities from taking open-source tools, rebranding them behind closed paywalls, and selling them as closed-source SaaS without contributing back to the community. It keeps the core open forever.
