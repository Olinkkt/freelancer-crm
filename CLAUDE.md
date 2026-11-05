# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `pnpm dev` — dev server on :3000 (Turbopack). Uses `DATABASE_URL`, default `file:./data/crm.db`.
- `pnpm build` — standalone production build (`output: 'standalone'`). CI runs `pnpm test` then `pnpm build`.
- `pnpm test` — all tests (`node:test` + `tsx`) against `data/test.db`. Tests wipe tables, so never point them at a real DB.
- Single file: `DATABASE_URL=file:./data/test.db node --import tsx --test tests/repository.test.ts`
- Single test by name: add `--test-name-pattern="moveDealStage"`.
- Typecheck: `npx tsc --noEmit -p .`. There is no lint script (`next lint` no longer exists in this Next version).

## Architecture

Single-operator, local-first CRM: Next.js App Router, React 19, Kysely, SQLite via libsql (or Postgres when `DATABASE_URL` is `postgres://…`).

- **One-page client app.** `app/page.tsx` is one large client component. Home, Clients, Deals and Settings are switched by `activeView` state, not routes. It loads the whole workspace once (`fetchWorkspaceData`), updates state optimistically, then replaces it with what the server action returns. Modals, the ⌘K palette (`components/command-palette/`) and global keyboard shortcuts all live there too.
- **Data flow:** UI → server actions in `app/actions/crm.ts` (each one calls `assertAuth()`) → `lib/db/repository.ts`. REST routes in `app/api/*` (deals, contacts, follow-ups, backup, calendar feed, health) call the same repository and validate input with zod schemas from `lib/validations/index.ts`.
- **Schema and migrations:** there are no migration files. `lib/db/init.ts` `ensureDbInitialized()` creates tables and runs idempotent in-place migrations on every cold start, gated by `SCHEMA_VERSION`. To change the schema, add a step there and bump `SCHEMA_VERSION`. Kysely table types are in `lib/db/schema.ts`. JSON columns (`deliverables`, `invoices`) are parsed with `safeParseJson`.
- **Domain types:** `lib/crm-types.ts`. `DEAL_STAGES` is the single source for stage type, validation, filters and pickers.
- **Auth:** the gate is on if `AUTH_SECRET` is set **or** `workspace_settings.passcode_hash` is set in the DB. `lib/auth/session.ts` `checkIsAuthenticated(req?)` handles both the cookie session and API requests. First run claims the workspace through the setup wizard.
- **Calendar:** it is a one-way `.ics` feed only (`lib/calendar/ical-generator.ts`, served at `/api/calendar/feed/[token]`). There is no Google OAuth.
- **Money:** amounts are stored as `raw_amount` plus a preformatted `value` string. Format with `formatMoney` / `formatDealValue` from `lib/config.ts`, using workspace settings for currency and locale (default Kč / cs-CZ).
- **Styling:** Tailwind v4 plus hand-written classes in `app/globals.css`, with shadcn/base-ui primitives in `components/ui/`. The visual language (single cobalt accent `#266df0`, hairline borders) is described in `DESIGN.md`.

## Product rules (settled — don't reopen)

- Clients are people. There are no companies, teams or roles (solo-tenancy only).
- Deal stages are **Lead · Qualified · Proposal · Won**. Won means contract signed, i.e. handoff to project work. There is no Paid and no Lost stage. Payment and project tracking belong to a later PM stage.
- Deals are a list or table with stage filters. Don't bring back Kanban.
- Every deal is expected to have a next action and due date (GTD rule from `CONTRIBUTING.md`). A deal can instead be **waiting on client** (`deal.waiting`): no next action or date is shown, there's no warning, and it sits in Today's waiting group until you clear it.
- Deal notes are `deal.notes`, edited in `components/modals/notes-modal.tsx` (also reachable from the ⌘K scratchpad). Open it on a specific deal through `notesDealId` / "Notes" in the row menu or "Open notes" on the deal detail. A deal is just its next action plus one markdown note (`NotesModal`, autosaves). There are no activities: the table was dropped in schema v14 and there is no feed or log. Old backups that still carry an `activities` key import fine, the key is ignored.
- Keyboard-first: core actions get a shortcut. The shortcut list is in `components/modals/shortcuts-modal.tsx`.

## Gotchas

- `data/crm.db` holds the operator's real data. For browser smoke tests, use a copy (`sqlite3 data/crm.db ".backup <copy>"`) with `DATABASE_URL` pointing at it. Clear `passcode_hash` in the copy or the passcode screen blocks you.
- Run a second dev server from a separate directory with its own `pnpm install`. A symlinked `node_modules` breaks both Turbopack and webpack.
- Playwright is installed but its browsers may not be. Use `executablePath: '/usr/bin/chromium'`.
