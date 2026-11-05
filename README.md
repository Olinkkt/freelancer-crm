# Freelancer CRM

A keyboard-first, local-first CRM and project tracker for solo freelancers. It keeps leads, clients and active projects in one place, on your own machine.

[![CI](https://img.shields.io/github/actions/workflow/status/Olinkkt/freelancer-crm/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/Olinkkt/freelancer-crm/actions)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square)](./LICENSE)

![Demo: add three deals with the N key, jump around with G shortcuts, search with Ctrl K](./docs/assets/demo.gif)

## Install

```bash
git clone https://github.com/Olinkkt/freelancer-crm.git
cd freelancer-crm
docker compose up -d
```

Open <http://localhost:3000>. Data lives in a Docker volume (SQLite). First run walks you through a short setup wizard.

Without Docker: `pnpm install && pnpm dev` (Node 20+, pnpm 10+).

## What it does

- **One pipeline.** Lead → Qualified → Proposal → Closed, then Deposit → Materials → Build → Handoff → Revisions → Completed. Closing a deal hands it from sales to project work.
- **Every deal has a next action and a due date.** Or it is marked *waiting on client*. Home shows what is due, what you are waiting on and what needs you.
- **Project workspace per deal.** Task board, client materials checklist, invoices and notes.
- **Keyboard-first.** `N` new deal, `C` new client, `⌘K` / `Ctrl K` command palette, `G` then `H`/`D`/`C`/`S` to jump between views, `?` for the full list. Rebind in Settings.
- **Solo by design.** Clients are people. No teams, roles or companies.
- **Your data.** SQLite file by default, PostgreSQL optional. Backup and restore from Settings, plus a read-only `.ics` calendar feed.

## Use it from AI agents

Create a token in **Settings → API**, then connect Claude Code:

```bash
claude mcp add --transport http freelancer-crm http://localhost:3000/api/mcp \
  --header "Authorization: Bearer fcrm_..."
```

- MCP setup for each client: [docs/mcp.md](./docs/mcp.md)
- REST API (`/api/v1`, OpenAPI at `/api/v1/openapi.json`): [docs/api.md](./docs/api.md)
- Tokens are scoped (read or read/write), writes support dry run and idempotent retries, and every agent write is audit-logged.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| :--- | :--- |
| `DATABASE_URL` | `file:./data/crm.db` (SQLite) or `postgres://…` |
| `AUTH_SECRET` | Optional. Locks the app behind a passcode |

Currency and locale are set in Settings.

## Develop

```bash
pnpm dev      # dev server on :3000
pnpm test     # tests (use a throwaway DB, they wipe tables)
pnpm build    # production build
```

Deploying to a VPS or Coolify: [DEPLOY.md](./DEPLOY.md). Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md).

Built with Next.js 16, React 19, Kysely, SQLite (libsql) and Tailwind CSS v4.

## License

[AGPL-3.0](./LICENSE). Self-hosting and private changes for your own use are free.
