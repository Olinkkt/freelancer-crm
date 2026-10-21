import { db } from './client'
import { ensureDbInitialized } from './init'
import { GoogleCalendarIntegrationTable, GoogleCalendarEventTable } from './schema'
import {
  GoogleCalendarIntegration,
  GoogleCalendarEventMapping,
} from '@/lib/google-calendar/types'

function mapIntegrationRow(row: GoogleCalendarIntegrationTable): GoogleCalendarIntegration {
  return {
    id: row.id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expiry: Number(row.token_expiry),
    calendar_id: row.calendar_id,
    calendar_name: row.calendar_name,
    auto_sync: Boolean(row.auto_sync),
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapEventRow(row: GoogleCalendarEventTable): GoogleCalendarEventMapping {
  return {
    id: row.id,
    crm_type: row.crm_type,
    crm_id: row.crm_id,
    google_event_id: row.google_event_id,
    synced_at: row.synced_at,
  }
}

/**
 * Get active Google Calendar integration settings and tokens.
 */
export async function getGoogleCalendarIntegration(): Promise<GoogleCalendarIntegration | null> {
  await ensureDbInitialized()
  const row = await db
    .selectFrom('google_calendar_integrations')
    .selectAll()
    .executeTakeFirst()

  if (!row) return null
  return mapIntegrationRow(row)
}

/**
 * Save or update OAuth tokens for Google Calendar integration.
 * Preserves existing refresh_token if omitted on subsequent updates.
 */
export async function saveGoogleCalendarTokens(data: {
  access_token: string
  refresh_token?: string | null
  token_expiry: number
  calendar_id?: string
  calendar_name?: string
}): Promise<GoogleCalendarIntegration> {
  await ensureDbInitialized()
  const now = new Date().toISOString()
  const existing = await getGoogleCalendarIntegration()

  if (existing) {
    const refreshToken =
      data.refresh_token !== undefined ? data.refresh_token : existing.refresh_token
    const calendarId =
      data.calendar_id !== undefined ? data.calendar_id : existing.calendar_id
    const calendarName =
      data.calendar_name !== undefined ? data.calendar_name : existing.calendar_name

    await db
      .updateTable('google_calendar_integrations')
      .set({
        access_token: data.access_token,
        refresh_token: refreshToken ?? null,
        token_expiry: data.token_expiry,
        calendar_id: calendarId,
        calendar_name: calendarName,
        updated_at: now,
      })
      .where('id', '=', existing.id)
      .execute()

    return {
      id: existing.id,
      access_token: data.access_token,
      refresh_token: refreshToken ?? null,
      token_expiry: data.token_expiry,
      calendar_id: calendarId,
      calendar_name: calendarName,
      auto_sync: existing.auto_sync,
      last_synced_at: existing.last_synced_at,
      created_at: existing.created_at,
      updated_at: now,
    }
  }

  const integrationId = 'singleton'
  const calendarId = data.calendar_id || 'primary'
  const calendarName = data.calendar_name || 'Primary'
  const refreshToken = data.refresh_token ?? null

  await db
    .insertInto('google_calendar_integrations')
    .values({
      id: integrationId,
      access_token: data.access_token,
      refresh_token: refreshToken,
      token_expiry: data.token_expiry,
      calendar_id: calendarId,
      calendar_name: calendarName,
      auto_sync: 1,
      last_synced_at: null,
      created_at: now,
      updated_at: now,
    })
    .execute()

  return {
    id: integrationId,
    access_token: data.access_token,
    refresh_token: refreshToken,
    token_expiry: data.token_expiry,
    calendar_id: calendarId,
    calendar_name: calendarName,
    auto_sync: true,
    last_synced_at: null,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Update Google Calendar integration settings (e.g. calendar selection, auto-sync, last sync timestamp).
 */
export async function updateGoogleCalendarSettings(data: {
  calendar_id?: string
  calendar_name?: string
  auto_sync?: boolean
  last_synced_at?: string
}): Promise<GoogleCalendarIntegration | null> {
  await ensureDbInitialized()
  const existing = await getGoogleCalendarIntegration()
  if (!existing) return null

  const now = new Date().toISOString()
  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.calendar_id !== undefined) {
    updates.calendar_id = data.calendar_id
  }
  if (data.calendar_name !== undefined) {
    updates.calendar_name = data.calendar_name
  }
  if (data.auto_sync !== undefined) {
    updates.auto_sync = data.auto_sync ? 1 : 0
  }
  if (data.last_synced_at !== undefined) {
    updates.last_synced_at = data.last_synced_at
  }

  await db
    .updateTable('google_calendar_integrations')
    .set(updates)
    .where('id', '=', existing.id)
    .execute()

  return {
    ...existing,
    calendar_id: updates.calendar_id ?? existing.calendar_id,
    calendar_name: updates.calendar_name ?? existing.calendar_name,
    auto_sync: data.auto_sync !== undefined ? data.auto_sync : existing.auto_sync,
    last_synced_at:
      data.last_synced_at !== undefined ? data.last_synced_at : existing.last_synced_at,
    updated_at: now,
  }
}

/**
 * Delete Google Calendar integration record (clears connected tokens and settings).
 */
export async function deleteGoogleCalendarIntegration(): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db.deleteFrom('google_calendar_integrations').execute()
  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

/**
 * Retrieve mapping between a CRM entity (e.g., activity, deal, milestone, follow_up) and Google Calendar event.
 */
export async function getGoogleCalendarEventMapping(
  crmId: string,
  crmType: string
): Promise<GoogleCalendarEventMapping | null> {
  await ensureDbInitialized()
  const row = await db
    .selectFrom('google_calendar_events')
    .selectAll()
    .where('crm_id', '=', crmId)
    .where('crm_type', '=', crmType)
    .executeTakeFirst()

  if (!row) return null
  return mapEventRow(row)
}

/**
 * Retrieve mapping by Google Calendar event ID.
 */
export async function getGoogleCalendarEventMappingByGoogleId(
  googleEventId: string
): Promise<GoogleCalendarEventMapping | null> {
  await ensureDbInitialized()
  const row = await db
    .selectFrom('google_calendar_events')
    .selectAll()
    .where('google_event_id', '=', googleEventId)
    .executeTakeFirst()

  if (!row) return null
  return mapEventRow(row)
}

/**
 * Save or update mapping between a CRM entity and a Google Calendar event ID.
 */
export async function saveGoogleCalendarEventMapping(mapping: {
  crm_type: string
  crm_id: string
  google_event_id: string
}): Promise<GoogleCalendarEventMapping> {
  await ensureDbInitialized()
  const now = new Date().toISOString()

  // 1. Check if mapping exists for (crm_type, crm_id)
  const existingByCrm = await db
    .selectFrom('google_calendar_events')
    .selectAll()
    .where('crm_type', '=', mapping.crm_type)
    .where('crm_id', '=', mapping.crm_id)
    .executeTakeFirst()

  if (existingByCrm) {
    await db
      .updateTable('google_calendar_events')
      .set({
        google_event_id: mapping.google_event_id,
        synced_at: now,
      })
      .where('id', '=', existingByCrm.id)
      .execute()

    return {
      id: existingByCrm.id,
      crm_type: mapping.crm_type,
      crm_id: mapping.crm_id,
      google_event_id: mapping.google_event_id,
      synced_at: now,
    }
  }

  // 2. Check if mapping exists for google_event_id
  const existingByGoogle = await db
    .selectFrom('google_calendar_events')
    .selectAll()
    .where('google_event_id', '=', mapping.google_event_id)
    .executeTakeFirst()

  if (existingByGoogle) {
    await db
      .updateTable('google_calendar_events')
      .set({
        crm_type: mapping.crm_type,
        crm_id: mapping.crm_id,
        synced_at: now,
      })
      .where('id', '=', existingByGoogle.id)
      .execute()

    return {
      id: existingByGoogle.id,
      crm_type: mapping.crm_type,
      crm_id: mapping.crm_id,
      google_event_id: mapping.google_event_id,
      synced_at: now,
    }
  }

  // 3. Create new mapping
  const rand = Math.random().toString(36).substring(2, 8)
  const id = `gcal-evt-${Date.now()}-${rand}`

  await db
    .insertInto('google_calendar_events')
    .values({
      id,
      crm_type: mapping.crm_type,
      crm_id: mapping.crm_id,
      google_event_id: mapping.google_event_id,
      synced_at: now,
    })
    .execute()

  return {
    id,
    crm_type: mapping.crm_type,
    crm_id: mapping.crm_id,
    google_event_id: mapping.google_event_id,
    synced_at: now,
  }
}

/**
 * Delete mapping for a CRM entity by crm_id and crm_type.
 */
export async function deleteGoogleCalendarEventMapping(
  crmId: string,
  crmType: string
): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db
    .deleteFrom('google_calendar_events')
    .where('crm_id', '=', crmId)
    .where('crm_type', '=', crmType)
    .execute()

  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

/**
 * Delete mapping by Google Calendar event ID.
 */
export async function deleteGoogleCalendarEventMappingByGoogleId(
  googleEventId: string
): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db
    .deleteFrom('google_calendar_events')
    .where('google_event_id', '=', googleEventId)
    .execute()

  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

/**
 * List all Google Calendar event mappings.
 */
export async function listGoogleCalendarEventMappings(): Promise<GoogleCalendarEventMapping[]> {
  await ensureDbInitialized()
  const rows = await db
    .selectFrom('google_calendar_events')
    .selectAll()
    .orderBy('synced_at', 'desc')
    .execute()

  return rows.map(mapEventRow)
}

/**
 * Clear all event mappings (e.g. during reset).
 */
export async function clearAllGoogleCalendarEventMappings(): Promise<number> {
  await ensureDbInitialized()
  const result = await db.deleteFrom('google_calendar_events').execute()
  return Number(result[0]?.numDeletedRows ?? 0)
}
