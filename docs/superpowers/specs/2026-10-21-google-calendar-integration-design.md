# Google Calendar Integration Design

**Date:** 2026-10-21  
**Status:** In Review  
**Target:** Freelancer CRM Google Calendar Integration  

## 1. Overview & Goals
The objective is to provide a seamless Google Calendar integration for solo freelancers and consultants using Freelancer CRM. 
When activities (Calls, Meetings, Follow-ups), deal milestones, or deliverable due dates are scheduled or updated in the CRM, they can be synced to Google Calendar. Freelancers can also view their Google Calendar events inside the CRM's internal calendar view and generate 1-click Google Calendar web event creation links.

## 2. Architecture & Components

### 2.1 Authentication & Credentials Storage
- **OAuth 2.0 Flow**:
  - Connect Google Calendar via standard Google OAuth 2.0 (`offline` access with `prompt=consent` for refresh token).
  - Scope: `https://www.googleapis.com/auth/calendar.events` (read and write events) and optionally `https://www.googleapis.com/auth/calendar.readonly`.
  - Configured via environment variables:
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`
    - `GOOGLE_REDIRECT_URI` (defaults to `<origin>/api/auth/google/callback`)
- **Database Schema**:
  - New table `google_calendar_integrations`:
    - `id TEXT PRIMARY KEY` (singleton per workspace or keyed by operator)
    - `access_token TEXT NOT NULL`
    - `refresh_token TEXT NOT NULL`
    - `token_expiry INTEGER NOT NULL` (epoch ms)
    - `calendar_id TEXT NOT NULL DEFAULT 'primary'`
    - `calendar_name TEXT`
    - `auto_sync INTEGER NOT NULL DEFAULT 1` (0 or 1)
    - `last_synced_at TEXT`
    - `created_at TEXT NOT NULL`
    - `updated_at TEXT NOT NULL`
  - Event link mapping in `activities` or a separate `google_calendar_events` mapping table:
    - `google_calendar_events`:
      - `id TEXT PRIMARY KEY`
      - `crm_type TEXT NOT NULL` ('activity' | 'deal_next' | 'milestone')
      - `crm_id TEXT NOT NULL`
      - `google_event_id TEXT NOT NULL`
      - `synced_at TEXT NOT NULL`

### 2.2 API Endpoints
1. `GET /api/integrations/google-calendar/auth-url`
   - Generates Google OAuth authorization URL with state token.
2. `GET /api/integrations/google-calendar/callback`
   - Handles the OAuth redirect, exchanges code for access & refresh tokens, stores in DB, redirects back to Settings with `?gcal=success`.
3. `GET /api/integrations/google-calendar/status`
   - Checks if connected, returns calendar name, auto_sync status, last_synced_at.
4. `POST /api/integrations/google-calendar/disconnect`
   - Revokes/removes tokens and clears connection status.
5. `POST /api/integrations/google-calendar/sync`
   - Manually triggers push/pull sync.
6. `GET /api/integrations/google-calendar/events`
   - Fetches upcoming Google Calendar events for the active workweek view in CRM Calendar.

### 2.3 Server Actions & Push Sync
- Server action `syncActivityToGoogleCalendar(activityId)`:
  - If Google Calendar is connected, push activity to Google Calendar via REST API (create or update event).
  - If event exists in `google_calendar_events`, update `PATCH`, else `POST`.
- Server action `deleteGoogleCalendarEvent(activityId)`:
  - Delete remote event when CRM activity is deleted.
- Utility `generateGoogleCalendarWebLink(event)`:
  - Generates zero-auth `https://calendar.google.com/calendar/render?action=TEMPLATE&...` URL for immediate 1-click fallback even without OAuth configured!

### 2.4 UI Integration
1. **Settings Modal (`components/modals/edit-settings-modal.tsx`)**:
   - Google Calendar section:
     - "Connect Google Calendar" button (or "Connected as [Calendar Name]" with Disconnect option).
     - Auto-sync toggle.
     - Status indicators (Connected / Not Connected / Last Synced).
2. **Calendar View (`components/calendar/calendar-view.tsx`)**:
   - Indicator showing Google Calendar sync status.
   - Merges remote Google events with visual badge (`GCal` badge or Google logo icon) into the workweek time slots.
3. **Activity Card & Log Call Modal**:
   - "Open in Google Calendar" link if synced, or "Add to Google Calendar" 1-click link.

## 3. Graceful Fallbacks & Local-First Philosophy
- If Google OAuth keys are not configured in `.env`, the UI explains that Google OAuth keys (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) can be set, while still providing the instant 1-click "Add to Google Calendar" link for any activity or follow-up!
- All external API calls are resilient, non-blocking, and safely caught so local CRM operations never fail if Google API is offline or unconfigured.

## 4. Verification & Testing Plan
- Unit tests for Google token refresh logic and event formatting.
- Unit tests for zero-auth Google Calendar URL generator.
- Integration tests for `/api/integrations/google-calendar/*` routes with mocked Google API.
- UI tests for Settings modal connect/disconnect states and calendar event rendering.
