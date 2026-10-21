import { describe, it, before, beforeEach, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'
import {
  saveGoogleCalendarTokens,
  getGoogleCalendarIntegration,
  getGoogleCalendarEventMapping,
} from '@/lib/db/google-calendar-repository'
import { createSessionToken } from '@/lib/auth/session'

import { GET as getStatus } from '@/app/api/integrations/google-calendar/status/route'
import { GET as getAuthUrl } from '@/app/api/integrations/google-calendar/auth-url/route'
import { GET as getCallback } from '@/app/api/integrations/google-calendar/callback/route'
import { POST as postDisconnect } from '@/app/api/integrations/google-calendar/disconnect/route'
import { GET as getEvents } from '@/app/api/integrations/google-calendar/events/route'
import { POST as postSync } from '@/app/api/integrations/google-calendar/sync/route'

import {
  getGoogleCalendarStatusAction,
  disconnectGoogleCalendarAction,
  triggerGoogleCalendarSyncAction,
  syncActivityToGoogleCalendarAction,
  deleteActivityFromGoogleCalendarAction,
  generateActivityGoogleWebLinkAction,
  updateGoogleCalendarSettingsAction,
} from '@/app/actions/google-calendar'
import { logActivityAction, deleteActivityAction } from '@/app/actions/crm'

describe('Google Calendar API Endpoints & Server Actions', () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  before(async () => {
    await ensureDbInitialized()
  })

  after(async () => {
    process.env = { ...originalEnv }
    globalThis.fetch = originalFetch
    await db.deleteFrom('google_calendar_events').execute()
    await db.deleteFrom('google_calendar_integrations').execute()
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('companies').execute()
  })

  beforeEach(async () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REDIRECT_URI
    delete process.env.AUTH_SECRET

    await db.deleteFrom('google_calendar_events').execute()
    await db.deleteFrom('google_calendar_integrations').execute()
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('companies').execute()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('GET /api/integrations/google-calendar/status', () => {
    it('returns connected=false and configured=false when unconfigured and disconnected', async () => {
      const res = await getStatus()
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.connected, false)
      assert.equal(body.configured, false)
      assert.equal(body.calendarName, undefined)
    })

    it('returns configured=true when environment variables are set', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

      const res = await getStatus()
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.connected, false)
      assert.equal(body.configured, true)
    })

    it('returns full connection metadata when active integration exists in database', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

      await saveGoogleCalendarTokens({
        access_token: 'valid-test-access-token',
        refresh_token: 'test-refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
        calendar_name: 'Work Calendar',
      })

      const res = await getStatus()
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.connected, true)
      assert.equal(body.configured, true)
      assert.equal(body.calendarName, 'Work Calendar')
      assert.equal(body.calendarId, 'primary')
      assert.equal(body.autoSync, true)
      assert.equal(body.lastSyncedAt, null)
    })
  })

  describe('GET /api/integrations/google-calendar/auth-url', () => {
    it('returns 400 when GOOGLE_CLIENT_ID is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      const req = new Request('http://localhost:3000/api/integrations/google-calendar/auth-url')

      const res = await getAuthUrl(req)
      assert.equal(res.status, 400)

      const body = await res.json()
      assert.ok(body.error.includes('GOOGLE_CLIENT_ID is not configured'))
    })

    it('returns 200 with valid Google OAuth URL when configured', async () => {
      process.env.GOOGLE_CLIENT_ID = 'my-oauth-client-id'
      const req = new Request(
        'http://localhost:3000/api/integrations/google-calendar/auth-url?state=test-state-nonce'
      )

      const res = await getAuthUrl(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.ok(body.url)
      const parsed = new URL(body.url)
      assert.equal(parsed.hostname, 'accounts.google.com')
      assert.equal(parsed.searchParams.get('client_id'), 'my-oauth-client-id')
      assert.equal(parsed.searchParams.get('state'), 'test-state-nonce')
      assert.equal(
        parsed.searchParams.get('redirect_uri'),
        'http://localhost:3000/api/integrations/google-calendar/callback'
      )
    })

    it('respects GOOGLE_REDIRECT_URI environment variable override', async () => {
      process.env.GOOGLE_CLIENT_ID = 'my-oauth-client-id'
      process.env.GOOGLE_REDIRECT_URI = 'https://myapp.com/oauth/gcal/callback'

      const req = new Request('http://localhost:3000/api/integrations/google-calendar/auth-url')
      const res = await getAuthUrl(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      const parsed = new URL(body.url)
      assert.equal(parsed.searchParams.get('redirect_uri'), 'https://myapp.com/oauth/gcal/callback')
    })
  })

  describe('GET /api/integrations/google-calendar/callback', () => {
    it('redirects with error when Google returns error parameter', async () => {
      const req = new Request(
        'http://localhost:3000/api/integrations/google-calendar/callback?error=access_denied'
      )
      const res = await getCallback(req)

      assert.ok(res.status === 302 || res.status === 307)
      const location = res.headers.get('location')
      assert.ok(location)
      const locUrl = new URL(location, 'http://localhost:3000')
      assert.equal(locUrl.searchParams.get('settings'), 'open')
      assert.equal(locUrl.searchParams.get('gcal'), 'error')
      assert.equal(locUrl.searchParams.get('message'), 'access_denied')
    })

    it('redirects with error when code is missing', async () => {
      const req = new Request('http://localhost:3000/api/integrations/google-calendar/callback')
      const res = await getCallback(req)

      assert.ok(res.status === 302 || res.status === 307)
      const location = res.headers.get('location')
      assert.ok(location)
      const locUrl = new URL(location, 'http://localhost:3000')
      assert.equal(locUrl.searchParams.get('gcal'), 'error')
      assert.ok(locUrl.searchParams.get('message')?.includes('code missing'))
    })

    it('redirects with error when Google OAuth credentials are missing from environment', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET

      const req = new Request(
        'http://localhost:3000/api/integrations/google-calendar/callback?code=some-valid-code'
      )
      const res = await getCallback(req)

      assert.ok(res.status === 302 || res.status === 307)
      const location = res.headers.get('location')
      assert.ok(location)
      const locUrl = new URL(location, 'http://localhost:3000')
      assert.equal(locUrl.searchParams.get('gcal'), 'error')
      assert.ok(locUrl.searchParams.get('message')?.includes('credentials not configured'))
    })

    it('exchanges code, saves tokens to database, and redirects with gcal=connected on success', async () => {
      process.env.GOOGLE_CLIENT_ID = 'client-id-abc'
      process.env.GOOGLE_CLIENT_SECRET = 'client-sec-xyz'

      globalThis.fetch = async (url: any) => {
        if (String(url).includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'received-access-token-123',
              refresh_token: 'received-refresh-token-456',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
            { status: 200 }
          )
        }
        return new Response('Not found', { status: 404 })
      }

      const req = new Request(
        'http://localhost:3000/api/integrations/google-calendar/callback?code=valid-auth-code&state=nonce'
      )
      const res = await getCallback(req)

      assert.ok(res.status === 302 || res.status === 307)
      const location = res.headers.get('location')
      assert.ok(location)
      const locUrl = new URL(location, 'http://localhost:3000')
      assert.equal(locUrl.searchParams.get('settings'), 'open')
      assert.equal(locUrl.searchParams.get('gcal'), 'connected')

      // Verify tokens saved to DB
      const stored = await getGoogleCalendarIntegration()
      assert.ok(stored)
      assert.equal(stored.access_token, 'received-access-token-123')
      assert.equal(stored.refresh_token, 'received-refresh-token-456')
    })
  })

  describe('POST /api/integrations/google-calendar/disconnect', () => {
    it('deletes active integration and clears event mappings', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'to-be-deleted',
        refresh_token: 'to-be-deleted',
        token_expiry: Date.now() + 3600000,
      })

      const req = new Request('http://localhost:3000/api/integrations/google-calendar/disconnect', {
        method: 'POST',
      })
      const res = await postDisconnect(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.equal(body.disconnected, true)

      const integration = await getGoogleCalendarIntegration()
      assert.equal(integration, null)
    })
  })

  describe('GET /api/integrations/google-calendar/events', () => {
    it('returns empty events array when Google Calendar is not connected', async () => {
      const req = new Request('http://localhost:3000/api/integrations/google-calendar/events')
      const res = await getEvents(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.deepEqual(body.events, [])
    })

    it('returns remote Google Calendar events when connected', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'active-calendar-access-token',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      let capturedUrl = ''
      globalThis.fetch = async (url: any) => {
        capturedUrl = String(url)
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'remote-event-1',
                summary: 'Quarterly Sync',
                start: { dateTime: '2026-10-21T10:00:00Z' },
                end: { dateTime: '2026-10-21T11:00:00Z' },
              },
            ],
          }),
          { status: 200 }
        )
      }

      const req = new Request(
        'http://localhost:3000/api/integrations/google-calendar/events?timeMin=2026-10-01T00:00:00Z&timeMax=2026-10-31T23:59:59Z'
      )
      const res = await getEvents(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.events.length, 1)
      assert.equal(body.events[0].id, 'remote-event-1')
      assert.equal(body.events[0].summary, 'Quarterly Sync')
      assert.ok(capturedUrl.includes('timeMin=2026-10-01'))
    })

    it('automatically refreshes token if expired before listing events', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id'
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

      await saveGoogleCalendarTokens({
        access_token: 'expired-access-token',
        refresh_token: 'valid-refresh-token',
        token_expiry: Date.now() - 10000, // Expired
        calendar_id: 'primary',
      })

      let tokenRefreshed = false
      globalThis.fetch = async (url: any) => {
        const u = String(url)
        if (u.includes('oauth2.googleapis.com/token')) {
          tokenRefreshed = true
          return new Response(
            JSON.stringify({
              access_token: 'refreshed-new-access-token',
              expires_in: 3600,
            }),
            { status: 200 }
          )
        }
        if (u.includes('/calendars/primary/events')) {
          return new Response(JSON.stringify({ items: [] }), { status: 200 })
        }
        return new Response('Not found', { status: 404 })
      }

      const req = new Request('http://localhost:3000/api/integrations/google-calendar/events')
      const res = await getEvents(req)
      assert.equal(res.status, 200)

      assert.equal(tokenRefreshed, true)
      const updated = await getGoogleCalendarIntegration()
      assert.equal(updated?.access_token, 'refreshed-new-access-token')
    })
  })

  describe('POST /api/integrations/google-calendar/sync', () => {
    it('returns 400 with error if not connected', async () => {
      const req = new Request('http://localhost:3000/api/integrations/google-calendar/sync', {
        method: 'POST',
      })
      const res = await postSync(req)
      assert.equal(res.status, 400)

      const body = await res.json()
      assert.equal(body.success, false)
      assert.equal(body.error, 'Google Calendar is not connected')
    })

    it('pushes upcoming CRM activities and deal next-steps to Google Calendar and updates mappings', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'valid-sync-access-token',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      // Create an activity (type: 'Call') and a deal with next action
      await repo.logActivity({
        type: 'Call',
        title: 'Project Kickoff Call',
        person: 'Sarah Connor',
        company: 'Cyberdyne Systems',
        date: '2026-10-22',
        status: 'Upcoming',
        color: 'blue',
        summary: 'Review tech specifications and timeline',
      })

      const deal = await repo.createDeal({
        title: 'Cloud Migration',
        company: 'Cyberdyne Systems',
        value: '$25,000',
        rawAmount: 25000,
        stage: 'Proposal',
        probability: '70%',
        next: 'Send final contract for signoff',
        nextDueDate: '2026-10-23',
        color: 'violet',
      })

      const createdEvents: any[] = []
      globalThis.fetch = async (url: any, init: any) => {
        const u = String(url)
        if (u.includes('/calendars/primary/events') && init?.method === 'POST') {
          const body = JSON.parse(init.body)
          const newEvent = {
            id: `gcal-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...body,
          }
          createdEvents.push(newEvent)
          return new Response(JSON.stringify(newEvent), { status: 200 })
        }
        return new Response('Not found', { status: 404 })
      }

      const req = new Request('http://localhost:3000/api/integrations/google-calendar/sync', {
        method: 'POST',
      })
      const res = await postSync(req)
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.success, true)
      assert.ok(body.syncedCount >= 2)

      // Verify mappings created in DB
      const workspace = await repo.getWorkspaceData()
      const activity = workspace.activities.find((a) => a.title === 'Project Kickoff Call')
      assert.ok(activity)

      const actMapping = await getGoogleCalendarEventMapping(activity.id, 'activity')
      assert.ok(actMapping)
      assert.ok(actMapping.google_event_id.startsWith('gcal-evt-'))

      const dealMapping = await getGoogleCalendarEventMapping(deal.id, 'deal')
      assert.ok(dealMapping)
      assert.ok(dealMapping.google_event_id.startsWith('gcal-evt-'))

      // Verify integration last_synced_at is updated
      const integration = await getGoogleCalendarIntegration()
      assert.ok(integration?.last_synced_at)
    })
  })

  describe('Security & Authentication (AUTH_SECRET)', () => {
    const TEST_AUTH_SECRET = 'secret-auth-key-for-test'
    let validToken: string

    beforeEach(() => {
      process.env.AUTH_SECRET = TEST_AUTH_SECRET
      validToken = createSessionToken()
    })

    it('rejects unauthenticated requests to protected API routes with 401 Unauthorized', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client'

      // 1. auth-url
      const authUrlRes = await getAuthUrl(
        new Request('http://localhost:3000/api/integrations/google-calendar/auth-url')
      )
      assert.equal(authUrlRes.status, 401)
      const authUrlBody = await authUrlRes.json()
      assert.equal(authUrlBody.error, 'Unauthorized')

      // 2. disconnect
      const disconnectRes = await postDisconnect(
        new Request('http://localhost:3000/api/integrations/google-calendar/disconnect', {
          method: 'POST',
        })
      )
      assert.equal(disconnectRes.status, 401)

      // 3. events
      const eventsRes = await getEvents(
        new Request('http://localhost:3000/api/integrations/google-calendar/events')
      )
      assert.equal(eventsRes.status, 401)

      // 4. sync
      const syncRes = await postSync(
        new Request('http://localhost:3000/api/integrations/google-calendar/sync', {
          method: 'POST',
        })
      )
      assert.equal(syncRes.status, 401)
    })

    it('allows requests with valid Authorization Bearer token when AUTH_SECRET is set', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client'

      const authedReq = new Request(
        'http://localhost:3000/api/integrations/google-calendar/auth-url',
        {
          headers: {
            Authorization: `Bearer ${validToken}`,
          },
        }
      )
      const res = await getAuthUrl(authedReq)
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.ok(body.url)
    })

    it('rejects server actions with Unauthorized error when unauthenticated and AUTH_SECRET is set', async () => {
      await assert.rejects(
        () => getGoogleCalendarStatusAction(),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => disconnectGoogleCalendarAction(),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => triggerGoogleCalendarSyncAction(),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => syncActivityToGoogleCalendarAction('any-activity-id'),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => deleteActivityFromGoogleCalendarAction('any-activity-id'),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => generateActivityGoogleWebLinkAction('any-activity-id'),
        /Unauthorized: Please authenticate to access workspace/
      )
    })
  })

  describe('Server Actions in app/actions/google-calendar.ts', () => {
    it('getGoogleCalendarStatusAction returns accurate status', async () => {
      const status = await getGoogleCalendarStatusAction()
      assert.equal(status.connected, false)
      assert.equal(status.configured, false)
    })

    it('generateActivityGoogleWebLinkAction generates fallback 1-click web link', async () => {
      const { activity } = await repo.logActivity({
        type: 'Meeting',
        title: 'Strategy Consultation',
        person: 'Elena Fisher',
        company: 'Naughty Dog',
        date: '2026-10-25',
        status: 'Upcoming',
        color: 'green',
        summary: 'Discussion about upcoming project roadmap',
      })

      const result = await generateActivityGoogleWebLinkAction(activity.id)
      assert.ok(result.url)
      assert.ok(result.url.startsWith('https://calendar.google.com/calendar/render?'))
      assert.ok(result.url.includes('Strategy%20Consultation'))
      assert.ok(result.url.includes('dates=20261025/20261026'))
    })

    it('generateActivityGoogleWebLinkAction throws error when activity does not exist', async () => {
      await assert.rejects(
        () => generateActivityGoogleWebLinkAction('non-existent-activity-id'),
        /Activity not found/
      )
    })

    it('syncActivityToGoogleCalendarAction & deleteActivityFromGoogleCalendarAction', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'action-test-access-token',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      const { activity } = await repo.logActivity({
        type: 'Call',
        title: 'Quarterly Checkup',
        person: 'Miles Morales',
        company: 'Daily Bugle',
        date: '2026-10-28',
        status: 'Upcoming',
        color: 'amber',
      })

      let eventCreated = false
      let eventDeleted = false

      globalThis.fetch = async (url: any, init: any) => {
        const method = init?.method || 'GET'
        const u = String(url)

        if (method === 'POST' && u.includes('/calendars/primary/events')) {
          eventCreated = true
          return new Response(
            JSON.stringify({
              id: 'gcal-remote-action-123',
              summary: 'Call: Quarterly Checkup',
              start: { date: '2026-10-28' },
              end: { date: '2026-10-29' },
            }),
            { status: 200 }
          )
        }

        if (method === 'DELETE' && u.includes('gcal-remote-action-123')) {
          eventDeleted = true
          return new Response(null, { status: 204 })
        }

        return new Response('Not found', { status: 404 })
      }

      // 1. Sync single activity
      const syncRes = await syncActivityToGoogleCalendarAction(activity.id)
      assert.equal(syncRes.success, true)
      assert.equal(syncRes.eventId, 'gcal-remote-action-123')
      assert.equal(eventCreated, true)

      const mapping = await getGoogleCalendarEventMapping(activity.id, 'activity')
      assert.ok(mapping)
      assert.equal(mapping.google_event_id, 'gcal-remote-action-123')

      // 2. Delete synced activity from Google Calendar
      const deleteRes = await deleteActivityFromGoogleCalendarAction(activity.id)
      assert.equal(deleteRes.success, true)
      assert.equal(eventDeleted, true)

      const mappingAfter = await getGoogleCalendarEventMapping(activity.id, 'activity')
      assert.equal(mappingAfter, null)
    })

    it('triggerGoogleCalendarSyncAction triggers batch sync', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'action-sync-token',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            id: 'mock-batch-id',
            summary: 'Synced Item',
            start: { date: '2026-10-29' },
            end: { date: '2026-10-30' },
          }),
          { status: 200 }
        )

      const syncResult = await triggerGoogleCalendarSyncAction()
      assert.equal(syncResult.success, true)
      assert.ok(typeof syncResult.syncedCount === 'number')
    })

    it('disconnectGoogleCalendarAction removes integration and mappings', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'action-to-disconnect',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
      })

      const disconnectResult = await disconnectGoogleCalendarAction()
      assert.equal(disconnectResult.success, true)

      const status = await getGoogleCalendarStatusAction()
      assert.equal(status.connected, false)
    })

    it('updateGoogleCalendarSettingsAction updates autoSync setting', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'action-settings-token',
        refresh_token: 'refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      const statusBefore = await getGoogleCalendarStatusAction()
      assert.equal(statusBefore.autoSync, true)

      const updated = await updateGoogleCalendarSettingsAction({ autoSync: false })
      assert.equal(updated.autoSync, false)

      const statusAfter = await getGoogleCalendarStatusAction()
      assert.equal(statusAfter.autoSync, false)
    })
  })

  describe('CRM Activities Google Calendar Auto-Sync Hook', () => {
    it('logActivityAction triggers Google Calendar sync when auto_sync is enabled', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'auto-sync-test-token',
        refresh_token: 'test-refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      let postCalled = false
      let postedBody: any = null

      globalThis.fetch = async (url: any, init?: any) => {
        const urlStr = String(url)
        if (urlStr.includes('/calendars/primary/events') && init?.method === 'POST') {
          postCalled = true
          postedBody = JSON.parse(init.body)
          return new Response(
            JSON.stringify({
              id: 'gcal-auto-synced-123',
              summary: postedBody.summary,
              start: postedBody.start,
              end: postedBody.end,
              htmlLink: 'https://calendar.google.com/event?eid=123',
            }),
            { status: 200 }
          )
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      const res = await logActivityAction({
        type: 'Meeting',
        title: 'Scoping Session with Alpha',
        person: 'Bob Smith',
        company: 'Alpha Inc',
        date: '2026-10-25T10:00:00Z',
        summary: 'Discuss architecture and deliverable scope',
        status: 'Upcoming',
        color: 'blue',
      })

      assert.ok(res.activity)
      assert.equal(postCalled, true)
      assert.ok(postedBody.summary.includes('Scoping Session with Alpha'))

      // Verify mapping was saved in database
      const mapping = await getGoogleCalendarEventMapping(res.activity.id, 'activity')
      assert.ok(mapping)
      assert.equal(mapping.google_event_id, 'gcal-auto-synced-123')
    })

    it('logActivityAction succeeds even if Google sync errors out or throws network error', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'auto-sync-error-token',
        refresh_token: 'test-refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      // Mock Google API throwing an error
      globalThis.fetch = async () => {
        throw new Error('Google API connection timeout or offline')
      }

      const res = await logActivityAction({
        type: 'Call',
        title: 'Emergency call with Beta',
        person: 'Carol',
        company: 'Beta Corp',
        date: '2026-10-26T14:00:00Z',
        status: 'Upcoming',
        color: 'blue',
      })

      assert.ok(res.activity)
      assert.equal(res.activity.title, 'Emergency call with Beta')

      // Local activity created successfully, mapping is not created
      const mapping = await getGoogleCalendarEventMapping(res.activity.id, 'activity')
      assert.equal(mapping, null)
    })

    it('logActivityAction succeeds when Google Calendar is disconnected', async () => {
      const res = await logActivityAction({
        type: 'Note',
        title: 'Disconnected workspace note',
        person: 'Dan',
        company: 'Gamma LLC',
        date: '2026-10-27',
        status: 'Upcoming',
        color: 'blue',
      })

      assert.ok(res.activity)
      assert.equal(res.activity.title, 'Disconnected workspace note')
    })

    it('deleteActivityAction unlinks and removes remote Google Calendar event', async () => {
      await saveGoogleCalendarTokens({
        access_token: 'delete-sync-token',
        refresh_token: 'test-refresh-token',
        token_expiry: Date.now() + 3600000,
        calendar_id: 'primary',
      })

      let deleteCalled = false
      let deletedEventId = ''

      globalThis.fetch = async (url: any, init?: any) => {
        const urlStr = String(url)
        if (urlStr.includes('/calendars/primary/events') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 'gcal-to-be-deleted-999',
              summary: 'Sync before delete',
              start: { date: '2026-10-28' },
              end: { date: '2026-10-29' },
            }),
            { status: 200 }
          )
        }
        if (init?.method === 'DELETE') {
          deleteCalled = true
          const match = urlStr.match(/events\/([^?]+)/)
          if (match) deletedEventId = decodeURIComponent(match[1])
          return new Response(null, { status: 204 })
        }
        return new Response(JSON.stringify({}), { status: 200 })
      }

      // 1. Create activity with auto-sync
      const createRes = await logActivityAction({
        type: 'Call',
        title: 'Call to be deleted',
        person: 'Eve',
        company: 'Epsilon Ltd',
        date: '2026-10-28',
        status: 'Upcoming',
        color: 'blue',
      })

      const mappingBefore = await getGoogleCalendarEventMapping(createRes.activity.id, 'activity')
      assert.ok(mappingBefore)
      assert.equal(mappingBefore.google_event_id, 'gcal-to-be-deleted-999')

      // 2. Delete activity
      const deleteRes = await deleteActivityAction(createRes.activity.id)
      assert.equal(deleteRes, true)
      assert.equal(deleteCalled, true)
      assert.equal(deletedEventId, 'gcal-to-be-deleted-999')

      // 3. Verify mapping is gone
      const mappingAfter = await getGoogleCalendarEventMapping(createRes.activity.id, 'activity')
      assert.equal(mappingAfter, null)
    })
  })
})
