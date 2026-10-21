/**
 * Google Calendar Integration Types
 */

export interface GoogleOAuthTokens {
  access_token: string
  refresh_token?: string
  token_expiry: number
  token_type?: string
  scope?: string
}

export interface GoogleCalendarIntegration {
  id: string
  access_token: string
  refresh_token?: string | null
  token_expiry: number
  calendar_id: string
  calendar_name: string
  auto_sync: boolean
  last_synced_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface GoogleCalendarEventDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

export interface GoogleCalendarEventItem {
  id: string
  summary: string
  description?: string | null
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
  location?: string | null
  htmlLink?: string
}

export type GoogleCalendarCrmType = 'deal' | 'follow_up' | 'activity' | string

export interface GoogleCalendarEventMapping {
  id: string
  crm_type: GoogleCalendarCrmType
  crm_id: string
  google_event_id: string
  synced_at?: string
}

export interface GoogleCalendarEventInput {
  summary: string
  description?: string
  location?: string
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
}

export interface GoogleCalendarWebLinkParams {
  title: string
  details?: string
  location?: string
  startTime?: string
  endTime?: string
  date?: string
  addHourDuration?: number
}

export interface GoogleCalendarStatusResponse {
  connected: boolean
  configured: boolean
  calendarName?: string
  calendarId?: string
  autoSync?: boolean
  lastSyncedAt?: string | null
}

export interface GoogleCalendarSyncResult {
  syncedCount: number
  success: boolean
  error?: string
}
