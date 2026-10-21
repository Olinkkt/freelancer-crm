# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Google Calendar into Freelancer CRM with OAuth 2.0 two-way/push sync, zero-auth 1-click fallback links, Settings management UI, and CRM calendar event overlay.

**Architecture:** A local-first, modular design. SQLite/LibSQL stores OAuth tokens and event mappings; REST endpoints and server actions handle Google OAuth and Google Calendar v3 API synchronization; a fallback generator provides instant 1-click event creation without OAuth; and UI components in Settings and Calendar display sync status and remote events.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Kysely (LibSQL / SQLite), Node test runner (`node --test`), Lucide icons, Tailwind CSS.

---

### File Structure Map

- `lib/google-calendar/types.ts`: TypeScript interfaces for Google tokens, integration settings, event mappings, and API request/response shapes.
- `lib/google-calendar/client.ts`: Google Calendar API client helper (OAuth URL builder, code exchange, token refresh, create/update/delete/list events via `fetch`).
- `lib/google-calendar/web-links.ts`: Zero-auth instant 1-click Google Calendar web link builder (`https://calendar.google.com/calendar/render?...`).
- `lib/db/schema.ts`: Database schema definitions for `google_calendar_integrations` and `google_calendar_events`.
- `lib/db/init.ts`: Schema migration to create tables and indexes idempotently.
- `lib/db/google-calendar-repository.ts`: Database repository functions for tokens, settings, and event mapping associations.
- `app/api/integrations/google-calendar/auth-url/route.ts`: API route returning OAuth authorization URL.
- `app/api/integrations/google-calendar/callback/route.ts`: OAuth redirect callback handler exchanging code for tokens and persisting them.
- `app/api/integrations/google-calendar/status/route.ts`: API route reporting connection status and sync metadata.
- `app/api/integrations/google-calendar/disconnect/route.ts`: API route revoking and removing Google connection.
- `app/api/integrations/google-calendar/events/route.ts`: API route returning events from Google Calendar for a date range.
- `app/api/integrations/google-calendar/sync/route.ts`: API route triggering push sync of CRM activities/milestones.
- `app/actions/google-calendar.ts`: Next.js server actions for client components to trigger sync, test connection, or get web links.
- `components/modals/edit-settings-modal.tsx`: Settings UI section for Google Calendar connection, auto-sync toggle, and status.
- `components/calendar/calendar-view.tsx`: Ingest and display Google Calendar events alongside CRM milestones/follow-ups.
- `components/modals/log-call-modal.tsx`: 1-click "Add to Google Calendar" button and Google sync status indicator.
- `tests/google-calendar.test.ts`: Automated tests covering URL generation, token handling, repository queries, and API routes.

---

### Task Breakdown

#### Task 1: Google Calendar Core Library & Web Link Fallback
- [x] Create `lib/google-calendar/types.ts` with integration, token, and event mapping types.
- [x] Create `lib/google-calendar/web-links.ts` to generate `https://calendar.google.com/calendar/render?action=TEMPLATE...` links with titles, dates, descriptions, attendees.
- [x] Create `lib/google-calendar/client.ts` with pure utility functions for auth URL generation, token refresh handling, and Google Calendar API endpoints (mockable fetch).
- [x] Write unit tests in `tests/google-calendar-client.test.ts` for URL generation, date formatting for Google Calendar API (RFC3339 / ISO), and parameter escaping.
- [x] Run tests and verify they pass.
- [x] Commit changes with message `feat(gcal): add google calendar types, api client, and web link generator`.

#### Task 2: Database Schema & Repository for Google Calendar Integration
- [x] Update `lib/db/schema.ts` to add `GoogleCalendarIntegrationTable` and `GoogleCalendarEventTable`.
- [x] Update `lib/db/init.ts` to add `CREATE TABLE IF NOT EXISTS google_calendar_integrations` and `google_calendar_events` with indexes.
- [x] Implement `lib/db/google-calendar-repository.ts` with functions:
  - `getGoogleCalendarIntegration()`
  - `saveGoogleCalendarTokens(integration)`
  - `updateGoogleCalendarSettings(settings)`
  - `deleteGoogleCalendarIntegration()`
  - `getGoogleCalendarEventMapping(crmId, crmType)`
  - `saveGoogleCalendarEventMapping(mapping)`
  - `deleteGoogleCalendarEventMapping(crmId, crmType)`
- [x] Write repository tests in `tests/google-calendar-db.test.ts`.
- [x] Run tests and verify they pass.
- [x] Commit changes with message `feat(gcal): add database tables and repository for google calendar sync`.

#### Task 3: API Routes & Server Actions for Google Calendar
- [x] Implement `app/api/integrations/google-calendar/auth-url/route.ts`.
- [x] Implement `app/api/integrations/google-calendar/callback/route.ts` with error handling and redirect to `/?settings=open&gcal=connected`.
- [x] Implement `app/api/integrations/google-calendar/status/route.ts`.
- [x] Implement `app/api/integrations/google-calendar/disconnect/route.ts`.
- [x] Implement `app/api/integrations/google-calendar/sync/route.ts` and `events/route.ts`.
- [x] Create `app/actions/google-calendar.ts` wrapping sync and status operations for UI server actions.
- [x] Write route integration tests in `tests/google-calendar-api.test.ts`.
- [x] Run all tests and verify they pass.
- [x] Commit changes with message `feat(gcal): implement google calendar oauth and sync api endpoints`.

#### Task 4: Settings Modal Google Calendar Configuration UI
- [x] Update `components/modals/edit-settings-modal.tsx` to include an "Integrations" section with Google Calendar.
- [x] Add connection status badges (Connected / Disconnected / Missing API Keys).
- [x] Add "Connect Google Calendar" button, "Disconnect" button, and "Auto-sync Activities" toggle.
- [x] Add copy explaining setup and `.env` variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- [x] Update `.env.example` with Google Calendar OAuth configuration comments.
- [x] Run test suite and check build.
- [x] Commit changes with message `feat(gcal): add google calendar integration settings to settings modal`.

#### Task 5: CRM Calendar View & Activity Cards Sync Integration
- [x] Update `components/calendar/calendar-view.tsx` to optionally display synced Google Calendar events with a distinct badge.
- [x] Add "Add to Google Calendar" 1-click web link to `components/modals/log-call-modal.tsx` and activity cards.
- [x] Hook activity creation (`logActivity`) to auto-sync to Google Calendar when auto-sync is enabled.
- [x] Write test verifying activity sync trigger and web link output.
- [x] Run full test suite (`pnpm test`) and build check (`pnpm build`).
- [x] Commit changes with message `feat(gcal): integrate google calendar events in calendar view and activity creation`.
