import {
  GoogleOAuthTokens,
  GoogleCalendarEventItem,
} from './types'

/**
 * Shape of raw event data returned by Google Calendar API v3
 */
interface RawGoogleCalendarEvent {
  id: string
  summary?: string
  description?: string | null
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string | null
  htmlLink?: string
}

/**
 * Maps a raw Google Calendar API event to our strongly-typed GoogleCalendarEventItem.
 */
function mapToGoogleCalendarEventItem(item: RawGoogleCalendarEvent): GoogleCalendarEventItem {
  return {
    id: item.id,
    summary: item.summary || '',
    description: item.description ?? null,
    start: {
      dateTime: item.start?.dateTime,
      date: item.start?.date,
      timeZone: item.start?.timeZone,
    },
    end: {
      dateTime: item.end?.dateTime,
      date: item.end?.date,
      timeZone: item.end?.timeZone,
    },
    location: item.location ?? null,
    htmlLink: item.htmlLink,
  }
}

/**
 * Safely extracts error details from an HTTP response by reading text once,
 * then attempting JSON parsing, avoiding stream consumption issues.
 */
async function extractErrorDetail(res: Response): Promise<string> {
  try {
    let text: string | undefined
    if (typeof res.text === 'function') {
      text = await res.text()
    } else if (typeof res.json === 'function') {
      const data = await res.json()
      if (typeof data === 'object' && data !== null) {
        if (data.error && typeof data.error === 'object' && data.error.message) {
          return data.error.message
        }
        if (typeof data.error_description === 'string') {
          return data.error_description
        }
        if (typeof data.error === 'string') {
          return data.error
        }
        return JSON.stringify(data)
      }
      return String(data)
    }

    if (!text) return res.statusText || String(res.status)
    try {
      const data = JSON.parse(text)
      if (typeof data === 'object' && data !== null) {
        if (data.error && typeof data.error === 'object' && data.error.message) {
          return data.error.message
        }
        if (typeof data.error_description === 'string') {
          return data.error_description
        }
        if (typeof data.error === 'string') {
          return data.error
        }
        return JSON.stringify(data)
      }
      return text
    } catch {
      return text
    }
  } catch {
    return res.statusText || String(res.status)
  }
}

/**
 * Builds the Google OAuth 2.0 authorization URL for initiating user consent.
 */
export function getGoogleAuthUrl(options: {
  clientId: string
  redirectUri: string
  state?: string
  scope?: string
}): string {
  if (!options.clientId || !options.clientId.trim()) {
    throw new Error('clientId is required to generate Google Auth URL')
  }
  if (!options.redirectUri || !options.redirectUri.trim()) {
    throw new Error('redirectUri is required to generate Google Auth URL')
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', options.clientId.trim())
  url.searchParams.set('redirect_uri', options.redirectUri.trim())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set(
    'scope',
    options.scope || 'https://www.googleapis.com/auth/calendar.events'
  )

  if (options.state) {
    url.searchParams.set('state', options.state)
  }

  return url.toString()
}

/**
 * Exchanges a one-time Google authorization code for access and refresh tokens.
 */
export async function exchangeGoogleCode(options: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleOAuthTokens> {
  if (!options.code || !options.code.trim()) {
    throw new Error('code is required for exchanging Google authorization code')
  }
  if (!options.clientId || !options.clientId.trim()) {
    throw new Error('clientId is required for exchanging Google authorization code')
  }
  if (!options.clientSecret || !options.clientSecret.trim()) {
    throw new Error('clientSecret is required for exchanging Google authorization code')
  }
  if (!options.redirectUri || !options.redirectUri.trim()) {
    throw new Error('redirectUri is required for exchanging Google authorization code')
  }

  const body = new URLSearchParams({
    code: options.code.trim(),
    client_id: options.clientId.trim(),
    client_secret: options.clientSecret.trim(),
    redirect_uri: options.redirectUri.trim(),
    grant_type: 'authorization_code',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const errorDetail = await extractErrorDetail(res)
    throw new Error(`Failed to exchange authorization code: ${res.status} ${errorDetail}`)
  }

  const data = await res.json()
  const expiresIn = Number(data.expires_in) || 3600

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expiry: Date.now() + expiresIn * 1000,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
  }
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(options: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ access_token: string; token_expiry: number }> {
  if (!options.refreshToken || !options.refreshToken.trim()) {
    throw new Error('refreshToken is required for refreshing access token')
  }
  if (!options.clientId || !options.clientId.trim()) {
    throw new Error('clientId is required for refreshing access token')
  }
  if (!options.clientSecret || !options.clientSecret.trim()) {
    throw new Error('clientSecret is required for refreshing access token')
  }

  const body = new URLSearchParams({
    refresh_token: options.refreshToken.trim(),
    client_id: options.clientId.trim(),
    client_secret: options.clientSecret.trim(),
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const errorDetail = await extractErrorDetail(res)
    throw new Error(`Failed to refresh Google access token: ${res.status} ${errorDetail}`)
  }

  const data = await res.json()
  const expiresIn = Number(data.expires_in) || 3600

  return {
    access_token: data.access_token,
    token_expiry: Date.now() + expiresIn * 1000,
  }
}

/**
 * Lists events from a Google Calendar.
 */
export async function listGoogleCalendarEvents(options: {
  accessToken: string
  calendarId?: string
  timeMin?: string
  timeMax?: string
}): Promise<GoogleCalendarEventItem[]> {
  if (!options.accessToken || !options.accessToken.trim()) {
    throw new Error('accessToken is required to list calendar events')
  }

  const calendarId = options.calendarId || 'primary'
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  )
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')

  if (options.timeMin) {
    url.searchParams.set('timeMin', options.timeMin)
  }
  if (options.timeMax) {
    url.searchParams.set('timeMax', options.timeMax)
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${options.accessToken.trim()}`,
    },
  })

  if (!res.ok) {
    const errorDetail = await extractErrorDetail(res)
    throw new Error(`Failed to list Google Calendar events: ${res.status} ${errorDetail}`)
  }

  const data = (await res.json()) as { items?: RawGoogleCalendarEvent[] }
  const items = Array.isArray(data.items) ? data.items : []

  return items.map(mapToGoogleCalendarEventItem)
}

/**
 * Creates an event in a Google Calendar.
 */
export async function createGoogleCalendarEvent(options: {
  accessToken: string
  calendarId?: string
  event: {
    summary: string
    description?: string
    location?: string
    start: { dateTime?: string; date?: string; timeZone?: string }
    end: { dateTime?: string; date?: string; timeZone?: string }
  }
}): Promise<GoogleCalendarEventItem> {
  if (!options.accessToken || !options.accessToken.trim()) {
    throw new Error('accessToken is required to create a calendar event')
  }
  if (!options.event || !options.event.summary || !options.event.summary.trim()) {
    throw new Error('event summary is required to create a calendar event')
  }
  if (!options.event.start || (!options.event.start.dateTime && !options.event.start.date)) {
    throw new Error('event start (dateTime or date) is required to create a calendar event')
  }
  if (!options.event.end || (!options.event.end.dateTime && !options.event.end.date)) {
    throw new Error('event end (dateTime or date) is required to create a calendar event')
  }

  const calendarId = options.calendarId || 'primary'
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options.event),
  })

  if (!res.ok) {
    const errorDetail = await extractErrorDetail(res)
    throw new Error(`Failed to create Google Calendar event: ${res.status} ${errorDetail}`)
  }

  const data = (await res.json()) as RawGoogleCalendarEvent
  return mapToGoogleCalendarEventItem(data)
}

/**
 * Updates an existing event in a Google Calendar.
 */
export async function updateGoogleCalendarEvent(options: {
  accessToken: string
  calendarId?: string
  eventId: string
  event: {
    summary?: string
    description?: string
    location?: string
    start?: { dateTime?: string; date?: string; timeZone?: string }
    end?: { dateTime?: string; date?: string; timeZone?: string }
  }
}): Promise<GoogleCalendarEventItem> {
  if (!options.accessToken || !options.accessToken.trim()) {
    throw new Error('accessToken is required to update a calendar event')
  }
  if (!options.eventId || !options.eventId.trim()) {
    throw new Error('eventId is required to update a calendar event')
  }

  const calendarId = options.calendarId || 'primary'
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(options.eventId.trim())}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${options.accessToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options.event),
  })

  if (!res.ok) {
    const errorDetail = await extractErrorDetail(res)
    throw new Error(`Failed to update Google Calendar event: ${res.status} ${errorDetail}`)
  }

  const data = (await res.json()) as RawGoogleCalendarEvent
  return mapToGoogleCalendarEventItem(data)
}

/**
 * Deletes an event from a Google Calendar.
 * Returns true if deleted, false if not found (404), or throws on other API errors.
 */
export async function deleteGoogleCalendarEvent(options: {
  accessToken: string
  calendarId?: string
  eventId: string
}): Promise<boolean> {
  if (!options.accessToken || !options.accessToken.trim()) {
    throw new Error('accessToken is required to delete a calendar event')
  }
  if (!options.eventId || !options.eventId.trim()) {
    throw new Error('eventId is required to delete a calendar event')
  }

  const calendarId = options.calendarId || 'primary'
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(options.eventId.trim())}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${options.accessToken.trim()}`,
    },
  })

  if (res.status === 204 || res.status === 200) {
    return true
  }

  if (res.status === 404) {
    return false
  }

  const errorDetail = await extractErrorDetail(res)
  throw new Error(`Failed to delete Google Calendar event: ${res.status} ${errorDetail}`)
}
