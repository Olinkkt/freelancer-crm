import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateGoogleCalendarWebLink,
  formatToUtcCompact,
  formatToDateCompact,
} from '../lib/google-calendar/web-links'
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleAccessToken,
  listGoogleCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '../lib/google-calendar/client'

describe('Google Calendar Web Links (generateGoogleCalendarWebLink)', () => {
  it('generates a minimal template URL with only a title', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Review proposal',
    })

    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'))
    assert.ok(url.includes('action=TEMPLATE'))
    assert.ok(url.includes('text=Review%20proposal'))
    assert.ok(!url.includes('dates='))
    assert.ok(!url.includes('details='))
    assert.ok(!url.includes('location='))
  })

  it('formats timed events using compact UTC format (YYYYMMDDTHHmmssZ)', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Sprint Planning',
      startTime: '2026-10-21T10:00:00.000Z',
      endTime: '2026-10-21T11:30:00.000Z',
    })

    assert.ok(url.includes('dates=20261021T100000Z/20261021T113000Z'))
    // Slash separating start and end must remain literal, not percent-encoded
    assert.ok(!url.includes('20261021T100000Z%2F20261021T113000Z'))
  })

  it('defaults to 1 hour duration when endTime is not provided', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Client Check-in',
      startTime: '2026-10-21T14:00:00.000Z',
    })

    assert.ok(url.includes('dates=20261021T140000Z/20261021T150000Z'))
  })

  it('supports custom addHourDuration when endTime is not provided', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Workshop',
      startTime: '2026-10-21T09:00:00.000Z',
      addHourDuration: 3,
    })

    assert.ok(url.includes('dates=20261021T090000Z/20261021T120000Z'))
  })

  it('formats all-day events with date parameter (YYYYMMDD/YYYYMMDD)', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Invoice Due',
      date: '2026-10-21',
    })

    // Single-day all-day event ends next day in Google Calendar
    assert.ok(url.includes('dates=20261021/20261022'))
  })

  it('handles multi-day all-day events', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Design Offsite',
      date: '2026-10-21',
      endTime: '2026-10-24',
    })

    assert.ok(url.includes('dates=20261021/20261024'))
  })

  it('combines date with time-only startTime string', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Demo Call',
      date: '2026-10-21',
      startTime: '15:30',
      addHourDuration: 1,
    })

    assert.ok(url.includes('dates=20261021T153000Z/20261021T163000Z'))
  })

  it('handles already-compact date strings', () => {
    const urlTimed = generateGoogleCalendarWebLink({
      title: 'Quick Sync',
      startTime: '20261021T100000Z',
      endTime: '20261021T103000Z',
    })
    assert.ok(urlTimed.includes('dates=20261021T100000Z/20261021T103000Z'))

    const urlAllDay = generateGoogleCalendarWebLink({
      title: 'Public Holiday',
      date: '20261028',
    })
    assert.ok(urlAllDay.includes('dates=20261028/20261029'))
  })

  it('encodes details, location, and special unicode characters', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Contract Kickoff & Demo 🚀',
      details: 'Discussion notes:\n- Milestones\n- Rates & Terms',
      location: 'Prague, Karlín / Google Meet',
      date: '2026-10-21',
    })

    assert.ok(url.includes('text=Contract%20Kickoff%20%26%20Demo%20%F0%9F%9A%80'))
    assert.ok(url.includes('location=Prague%2C%20Karl%C3%ADn%20%2F%20Google%20Meet'))
    assert.ok(url.includes('details='))
    assert.ok(url.includes('Milestones'))
  })

  it('date utility helpers format dates correctly', () => {
    const d = new Date(Date.UTC(2026, 9, 21, 10, 0, 0)) // 2026-10-21 10:00 UTC
    assert.equal(formatToUtcCompact(d), '20261021T100000Z')
    assert.equal(formatToDateCompact(d), '20261021')
  })
})

describe('Google Calendar OAuth URL (getGoogleAuthUrl)', () => {
  it('builds a valid Google OAuth consent URL with default scope', () => {
    const url = getGoogleAuthUrl({
      clientId: 'test-client-id.apps.googleusercontent.com',
      redirectUri: 'http://localhost:3000/api/integrations/google/callback',
    })

    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://accounts.google.com')
    assert.equal(parsed.pathname, '/o/oauth2/v2/auth')
    assert.equal(parsed.searchParams.get('client_id'), 'test-client-id.apps.googleusercontent.com')
    assert.equal(
      parsed.searchParams.get('redirect_uri'),
      'http://localhost:3000/api/integrations/google/callback'
    )
    assert.equal(parsed.searchParams.get('response_type'), 'code')
    assert.equal(parsed.searchParams.get('access_type'), 'offline')
    assert.equal(parsed.searchParams.get('prompt'), 'consent')
    assert.equal(
      parsed.searchParams.get('scope'),
      'https://www.googleapis.com/auth/calendar.events'
    )
    assert.equal(parsed.searchParams.get('state'), null)
  })

  it('includes state and custom scope when provided', () => {
    const url = getGoogleAuthUrl({
      clientId: 'my-client-id',
      redirectUri: 'http://localhost:3000/callback',
      state: 'csrf-protection-nonce-12345',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
    })

    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get('state'), 'csrf-protection-nonce-12345')
    assert.equal(
      parsed.searchParams.get('scope'),
      'https://www.googleapis.com/auth/calendar.readonly'
    )
  })

  it('throws an error if clientId or redirectUri is missing', () => {
    assert.throws(
      () =>
        getGoogleAuthUrl({
          clientId: '',
          redirectUri: 'http://localhost:3000/callback',
        }),
      /clientId is required/
    )

    assert.throws(
      () =>
        getGoogleAuthUrl({
          clientId: 'client-id',
          redirectUri: '   ',
        }),
      /redirectUri is required/
    )
  })
})

describe('Google Calendar API Client: Validation & Missing Credentials', () => {
  it('exchangeGoogleCode validates all required parameters', async () => {
    await assert.rejects(
      exchangeGoogleCode({
        code: '',
        clientId: 'cid',
        clientSecret: 'csec',
        redirectUri: 'ruri',
      }),
      /code is required/
    )

    await assert.rejects(
      exchangeGoogleCode({
        code: 'auth-code',
        clientId: '',
        clientSecret: 'csec',
        redirectUri: 'ruri',
      }),
      /clientId is required/
    )

    await assert.rejects(
      exchangeGoogleCode({
        code: 'auth-code',
        clientId: 'cid',
        clientSecret: '',
        redirectUri: 'ruri',
      }),
      /clientSecret is required/
    )

    await assert.rejects(
      exchangeGoogleCode({
        code: 'auth-code',
        clientId: 'cid',
        clientSecret: 'csec',
        redirectUri: '',
      }),
      /redirectUri is required/
    )
  })

  it('refreshGoogleAccessToken validates all required parameters', async () => {
    await assert.rejects(
      refreshGoogleAccessToken({
        refreshToken: '',
        clientId: 'cid',
        clientSecret: 'csec',
      }),
      /refreshToken is required/
    )

    await assert.rejects(
      refreshGoogleAccessToken({
        refreshToken: 'rtok',
        clientId: '',
        clientSecret: 'csec',
      }),
      /clientId is required/
    )

    await assert.rejects(
      refreshGoogleAccessToken({
        refreshToken: 'rtok',
        clientId: 'cid',
        clientSecret: '',
      }),
      /clientSecret is required/
    )
  })

  it('listGoogleCalendarEvents requires accessToken', async () => {
    await assert.rejects(
      listGoogleCalendarEvents({
        accessToken: '',
      }),
      /accessToken is required/
    )
  })

  it('createGoogleCalendarEvent requires accessToken, summary, and dates', async () => {
    await assert.rejects(
      createGoogleCalendarEvent({
        accessToken: '',
        event: {
          summary: 'Test',
          start: { dateTime: '2026-10-21T10:00:00Z' },
          end: { dateTime: '2026-10-21T11:00:00Z' },
        },
      }),
      /accessToken is required/
    )

    await assert.rejects(
      createGoogleCalendarEvent({
        accessToken: 'tok',
        event: {
          summary: '',
          start: { dateTime: '2026-10-21T10:00:00Z' },
          end: { dateTime: '2026-10-21T11:00:00Z' },
        },
      }),
      /event summary is required/
    )

    await assert.rejects(
      createGoogleCalendarEvent({
        accessToken: 'tok',
        event: {
          summary: 'Valid summary',
          start: {},
          end: { dateTime: '2026-10-21T11:00:00Z' },
        },
      }),
      /event start/
    )

    await assert.rejects(
      createGoogleCalendarEvent({
        accessToken: 'tok',
        event: {
          summary: 'Valid summary',
          start: { dateTime: '2026-10-21T10:00:00Z' },
          end: {},
        },
      }),
      /event end/
    )
  })

  it('updateGoogleCalendarEvent requires accessToken and eventId', async () => {
    await assert.rejects(
      updateGoogleCalendarEvent({
        accessToken: '',
        eventId: 'evt-123',
        event: { summary: 'New Title' },
      }),
      /accessToken is required/
    )

    await assert.rejects(
      updateGoogleCalendarEvent({
        accessToken: 'tok',
        eventId: '',
        event: { summary: 'New Title' },
      }),
      /eventId is required/
    )
  })

  it('deleteGoogleCalendarEvent requires accessToken and eventId', async () => {
    await assert.rejects(
      deleteGoogleCalendarEvent({
        accessToken: '',
        eventId: 'evt-123',
      }),
      /accessToken is required/
    )

    await assert.rejects(
      deleteGoogleCalendarEvent({
        accessToken: 'tok',
        eventId: '',
      }),
      /eventId is required/
    )
  })
})

describe('Google Calendar API Client: HTTP Operations & Responses', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('exchangeGoogleCode successfully exchanges code for tokens', async () => {
    let capturedUrl = ''
    let capturedBody = ''

    globalThis.fetch = async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedBody = String(init?.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/calendar.events',
        }),
      } as any
    }

    const before = Date.now()
    const tokens = await exchangeGoogleCode({
      code: 'auth-code-xyz',
      clientId: 'client-id-123',
      clientSecret: 'secret-456',
      redirectUri: 'http://localhost:3000/callback',
    })

    assert.equal(capturedUrl, 'https://oauth2.googleapis.com/token')
    assert.ok(capturedBody.includes('code=auth-code-xyz'))
    assert.ok(capturedBody.includes('client_id=client-id-123'))
    assert.ok(capturedBody.includes('grant_type=authorization_code'))

    assert.equal(tokens.access_token, 'mock-access-token')
    assert.equal(tokens.refresh_token, 'mock-refresh-token')
    assert.equal(tokens.token_type, 'Bearer')
    assert.ok(tokens.token_expiry >= before + 3500 * 1000)
    assert.ok(tokens.token_expiry <= Date.now() + 3700 * 1000)
  })

  it('exchangeGoogleCode handles HTTP error responses from token endpoint', async () => {
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Code has expired or is invalid',
        }),
      } as any)

    await assert.rejects(
      exchangeGoogleCode({
        code: 'expired-code',
        clientId: 'cid',
        clientSecret: 'csec',
        redirectUri: 'http://localhost/cb',
      }),
      /Failed to exchange authorization code: 400 Code has expired or is invalid/
    )
  })

  it('refreshGoogleAccessToken successfully returns a new access token', async () => {
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-access-token-999',
          expires_in: 1800,
          token_type: 'Bearer',
        }),
      } as any)

    const before = Date.now()
    const res = await refreshGoogleAccessToken({
      refreshToken: 'valid-refresh-token',
      clientId: 'cid',
      clientSecret: 'csec',
    })

    assert.equal(res.access_token, 'new-access-token-999')
    assert.ok(res.token_expiry >= before + 1700 * 1000)
  })

  it('refreshGoogleAccessToken throws on invalid refresh token', async () => {
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_client',
          error_description: 'Unauthorized client',
        }),
      } as any)

    await assert.rejects(
      refreshGoogleAccessToken({
        refreshToken: 'bad-token',
        clientId: 'cid',
        clientSecret: 'csec',
      }),
      /Failed to refresh Google access token: 401 Unauthorized client/
    )
  })

  it('listGoogleCalendarEvents calls API with query params and maps events', async () => {
    let capturedUrl = ''
    let capturedAuth = ''

    globalThis.fetch = async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedAuth = init?.headers?.Authorization
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'event-1',
              summary: 'Client Discovery Call',
              description: 'Initial scope discussion',
              location: 'Google Meet',
              start: { dateTime: '2026-10-21T10:00:00Z' },
              end: { dateTime: '2026-10-21T11:00:00Z' },
              htmlLink: 'https://calendar.google.com/event?eid=1',
            },
            {
              id: 'event-2',
              summary: 'Deliverable Review',
              start: { date: '2026-10-22' },
              end: { date: '2026-10-23' },
            },
          ],
        }),
      } as any
    }

    const events = await listGoogleCalendarEvents({
      accessToken: 'test-token',
      calendarId: 'primary',
      timeMin: '2026-10-20T00:00:00Z',
      timeMax: '2026-10-25T23:59:59Z',
    })

    assert.ok(capturedUrl.includes('/calendars/primary/events'))
    assert.ok(capturedUrl.includes('singleEvents=true'))
    assert.ok(capturedUrl.includes('orderBy=startTime'))
    assert.ok(capturedUrl.includes('timeMin=2026-10-20T00%3A00%3A00Z'))
    assert.ok(capturedUrl.includes('timeMax=2026-10-25T23%3A59%3A59Z'))
    assert.equal(capturedAuth, 'Bearer test-token')

    assert.equal(events.length, 2)
    assert.equal(events[0].id, 'event-1')
    assert.equal(events[0].summary, 'Client Discovery Call')
    assert.equal(events[0].description, 'Initial scope discussion')
    assert.equal(events[0].location, 'Google Meet')
    assert.equal(events[0].start.dateTime, '2026-10-21T10:00:00Z')
    assert.equal(events[0].end.dateTime, '2026-10-21T11:00:00Z')
    assert.equal(events[0].htmlLink, 'https://calendar.google.com/event?eid=1')

    assert.equal(events[1].id, 'event-2')
    assert.equal(events[1].description, null)
    assert.equal(events[1].location, null)
    assert.equal(events[1].start.date, '2026-10-22')
  })

  it('createGoogleCalendarEvent sends POST and returns created item', async () => {
    let capturedMethod = ''
    let capturedPayload: any = null

    globalThis.fetch = async (url: any, init: any) => {
      capturedMethod = init?.method
      capturedPayload = JSON.parse(init?.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'created-event-99',
          summary: capturedPayload.summary,
          description: capturedPayload.description,
          start: capturedPayload.start,
          end: capturedPayload.end,
          location: capturedPayload.location,
          htmlLink: 'https://calendar.google.com/event?eid=created-event-99',
        }),
      } as any
    }

    const created = await createGoogleCalendarEvent({
      accessToken: 'valid-token',
      calendarId: 'c_abc123',
      event: {
        summary: 'Milestone Kickoff',
        description: 'Review invoice 1',
        location: 'Remote',
        start: { dateTime: '2026-10-22T09:00:00Z' },
        end: { dateTime: '2026-10-22T10:00:00Z' },
      },
    })

    assert.equal(capturedMethod, 'POST')
    assert.equal(capturedPayload.summary, 'Milestone Kickoff')
    assert.equal(created.id, 'created-event-99')
    assert.equal(created.summary, 'Milestone Kickoff')
    assert.equal(created.location, 'Remote')
  })

  it('updateGoogleCalendarEvent sends PATCH and returns updated item', async () => {
    let capturedMethod = ''
    let capturedUrl = ''
    let capturedPayload: any = null

    globalThis.fetch = async (url: any, init: any) => {
      capturedUrl = String(url)
      capturedMethod = init?.method
      capturedPayload = JSON.parse(init?.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'evt-update-1',
          summary: capturedPayload.summary,
          start: { dateTime: '2026-10-23T14:00:00Z' },
          end: { dateTime: '2026-10-23T15:00:00Z' },
        }),
      } as any
    }

    const updated = await updateGoogleCalendarEvent({
      accessToken: 'token-xyz',
      calendarId: 'primary',
      eventId: 'evt-update-1',
      event: {
        summary: 'Updated Summary Title',
      },
    })

    assert.equal(capturedMethod, 'PATCH')
    assert.ok(capturedUrl.includes('/calendars/primary/events/evt-update-1'))
    assert.equal(capturedPayload.summary, 'Updated Summary Title')
    assert.equal(updated.summary, 'Updated Summary Title')
  })

  it('deleteGoogleCalendarEvent handles 204, 200, 404, and error statuses', async () => {
    // 1. Success 204 No Content
    globalThis.fetch = async () => ({ ok: true, status: 204 } as any)
    const success204 = await deleteGoogleCalendarEvent({
      accessToken: 'tok',
      eventId: 'evt-1',
    })
    assert.equal(success204, true)

    // 2. Success 200 OK
    globalThis.fetch = async () => ({ ok: true, status: 200 } as any)
    const success200 = await deleteGoogleCalendarEvent({
      accessToken: 'tok',
      eventId: 'evt-1',
    })
    assert.equal(success200, true)

    // 3. Not Found 404
    globalThis.fetch = async () => ({ ok: false, status: 404 } as any)
    const notFound = await deleteGoogleCalendarEvent({
      accessToken: 'tok',
      eventId: 'nonexistent-evt',
    })
    assert.equal(notFound, false)

    // 4. Server Error 500 throws
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: 'Internal Calendar Server Error' },
        }),
      } as any)

    await assert.rejects(
      deleteGoogleCalendarEvent({
        accessToken: 'tok',
        eventId: 'evt-err',
      }),
      /Failed to delete Google Calendar event: 500 Internal Calendar Server Error/
    )
  })
})
