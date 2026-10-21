import {
  getGoogleCalendarIntegration,
  saveGoogleCalendarTokens,
  updateGoogleCalendarSettings,
  deleteGoogleCalendarIntegration,
  getGoogleCalendarEventMapping,
  saveGoogleCalendarEventMapping,
  deleteGoogleCalendarEventMapping,
  clearAllGoogleCalendarEventMappings,
} from '@/lib/db/google-calendar-repository'
import {
  refreshGoogleAccessToken,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from './client'
import { generateGoogleCalendarWebLink } from './web-links'
import {
  GoogleCalendarIntegration,
  GoogleCalendarEventItem,
  GoogleCalendarEventInput,
  GoogleCalendarEventDateTime,
  GoogleCalendarStatusResponse,
  GoogleCalendarSyncResult,
} from './types'
import { extractStartHour } from '@/lib/date-utils'
import * as repo from '@/lib/db/repository'
import { Activity, Deal } from '@/lib/crm-types'

/**
 * Returns connection and configuration status of Google Calendar integration.
 */
export async function getGoogleIntegrationStatus(): Promise<GoogleCalendarStatusResponse> {
  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  )
  const integration = await getGoogleCalendarIntegration()

  if (!integration || !integration.access_token) {
    return {
      connected: false,
      configured,
    }
  }

  return {
    connected: true,
    configured,
    calendarName: integration.calendar_name,
    calendarId: integration.calendar_id,
    autoSync: integration.auto_sync,
    lastSyncedAt: integration.last_synced_at ?? null,
  }
}

/**
 * Gets a valid Google access token, automatically refreshing if expired or expiring within 60s.
 */
export async function getAuthenticatedGoogleClient(): Promise<{
  accessToken: string
  calendarId: string
  integration: GoogleCalendarIntegration
} | null> {
  const integration = await getGoogleCalendarIntegration()
  if (!integration || !integration.access_token) {
    return null
  }

  let accessToken = integration.access_token
  const now = Date.now()

  // If token is expired or expiring within 60 seconds, attempt refresh
  if (integration.token_expiry <= now + 60000) {
    const refreshToken = integration.refresh_token
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

    if (refreshToken && clientId && clientSecret) {
      try {
        const refreshed = await refreshGoogleAccessToken({
          refreshToken,
          clientId,
          clientSecret,
        })

        const updated = await saveGoogleCalendarTokens({
          access_token: refreshed.access_token,
          token_expiry: refreshed.token_expiry,
          refresh_token: refreshToken,
          calendar_id: integration.calendar_id,
          calendar_name: integration.calendar_name,
        })

        return {
          accessToken: updated.access_token,
          calendarId: updated.calendar_id || 'primary',
          integration: updated,
        }
      } catch (err) {
        // If refresh fails, log and fallback to current token or null
        console.error('Failed to refresh Google Calendar token:', err)
      }
    }
  }

  return {
    accessToken,
    calendarId: integration.calendar_id || 'primary',
    integration,
  }
}

/**
 * Resolves CRM date strings into strongly-typed Google Calendar event dates.
 */
export function resolveEventDates(dateStr?: string | null): {
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
} {
  const defaultDurationMs = 60 * 60 * 1000 // 1 hour

  if (!dateStr || !dateStr.trim()) {
    const now = new Date()
    return {
      start: { dateTime: now.toISOString() },
      end: { dateTime: new Date(now.getTime() + defaultDurationMs).toISOString() },
    }
  }

  const clean = dateStr.trim()

  // 1. Exact all-day ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number)
    const startDate = new Date(Date.UTC(y, m - 1, d))
    const endDate = new Date(startDate.getTime() + 86400000)
    const endStr = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start: { date: clean },
      end: { date: endStr },
    }
  }

  // 2. Full ISO timestamp (e.g. 2026-10-21T14:00:00Z)
  const parsedDate = new Date(clean)
  if (!isNaN(parsedDate.getTime()) && (clean.includes('T') || clean.includes(':'))) {
    return {
      start: { dateTime: parsedDate.toISOString() },
      end: { dateTime: new Date(parsedDate.getTime() + defaultDurationMs).toISOString() },
    }
  }

  // 3. Natural date string handling (e.g. "Tomorrow, 10:00 AM", "Today, 14:00")
  const now = new Date()
  const targetDay = new Date(now)

  const lower = clean.toLowerCase()
  if (lower.includes('tomorrow') || lower.includes('zitra')) {
    targetDay.setDate(targetDay.getDate() + 1)
  }

  const hour = extractStartHour(clean, 10.0)
  const wholeHour = Math.floor(hour)
  const minutes = Math.round((hour - wholeHour) * 60)

  targetDay.setHours(wholeHour, minutes, 0, 0)

  return {
    start: { dateTime: targetDay.toISOString() },
    end: { dateTime: new Date(targetDay.getTime() + defaultDurationMs).toISOString() },
  }
}

/**
 * Builds GoogleCalendarEventInput from a CRM Activity.
 */
export function getActivityEventInput(activity: Activity): GoogleCalendarEventInput {
  const dates = resolveEventDates(activity.date)
  const summary = activity.title
    ? `${activity.type}: ${activity.title}`
    : `${activity.type} with ${activity.person || activity.company}`

  const details = [
    activity.person ? `Person: ${activity.person}` : null,
    activity.company ? `Company: ${activity.company}` : null,
    activity.summary || activity.notes ? `Notes:\n${activity.summary || activity.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    summary,
    description: details,
    location: activity.company || undefined,
    start: dates.start,
    end: dates.end,
  }
}

/**
 * Builds GoogleCalendarEventInput from a Deal next action.
 */
export function getDealNextEventInput(deal: Deal): GoogleCalendarEventInput {
  const dates = resolveEventDates(deal.nextDueDate)
  const summary = deal.company ? `${deal.company}: ${deal.next}` : deal.next

  const details = [
    `Deal: ${deal.title}`,
    deal.company ? `Company: ${deal.company}` : null,
    `Stage: ${deal.stage} (${deal.probability})`,
    deal.value ? `Value: ${deal.value}` : null,
    deal.contactName ? `Contact: ${deal.contactName} (${deal.contactEmail || ''})` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    summary,
    description: details,
    location: deal.company || undefined,
    start: dates.start,
    end: dates.end,
  }
}

/**
 * Generates instant 1-click fallback Google Calendar web link for a CRM activity.
 */
export function getActivityWebLink(activity: Activity): string {
  const dates = resolveEventDates(activity.date)
  const isAllDay = Boolean(dates.start.date)

  return generateGoogleCalendarWebLink({
    title: activity.title
      ? `${activity.type}: ${activity.title}`
      : `${activity.type} with ${activity.person || activity.company}`,
    details: [
      activity.person ? `Person: ${activity.person}` : null,
      activity.company ? `Company: ${activity.company}` : null,
      activity.summary || activity.notes ? activity.summary || activity.notes : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    location: activity.company || undefined,
    date: isAllDay ? dates.start.date : undefined,
    startTime: !isAllDay ? dates.start.dateTime : undefined,
    endTime: !isAllDay ? dates.end.dateTime : undefined,
    addHourDuration: 1,
  })
}

/**
 * Pushes upcoming CRM activities and deal next-steps to Google Calendar.
 */
export async function syncAllToGoogleCalendar(): Promise<GoogleCalendarSyncResult> {
  const client = await getAuthenticatedGoogleClient()
  if (!client) {
    return {
      success: false,
      syncedCount: 0,
      error: 'Google Calendar is not connected',
    }
  }

  const workspace = await repo.getWorkspaceData()
  let syncedCount = 0

  // 1. Sync activities (Meeting, Call, Follow-up) that are not completed
  const syncableTypes = ['meeting', 'call', 'follow-up']
  const activitiesToSync = workspace.activities.filter(
    (a) =>
      syncableTypes.includes((a.type || '').toLowerCase()) &&
      a.status !== 'Completed'
  )

  for (const activity of activitiesToSync) {
    try {
      const eventInput = getActivityEventInput(activity)
      const mapping = await getGoogleCalendarEventMapping(activity.id, 'activity')

      if (mapping) {
        try {
          await updateGoogleCalendarEvent({
            accessToken: client.accessToken,
            calendarId: client.calendarId,
            eventId: mapping.google_event_id,
            event: eventInput,
          })
          syncedCount++
        } catch (err: any) {
          // If remote event was deleted (404), re-create and update mapping
          if (String(err?.message || '').includes('404')) {
            const created = await createGoogleCalendarEvent({
              accessToken: client.accessToken,
              calendarId: client.calendarId,
              event: eventInput,
            })
            await saveGoogleCalendarEventMapping({
              crm_type: 'activity',
              crm_id: activity.id,
              google_event_id: created.id,
            })
            syncedCount++
          } else {
            console.error(`Failed to update activity ${activity.id} in Google Calendar:`, err)
          }
        }
      } else {
        const created = await createGoogleCalendarEvent({
          accessToken: client.accessToken,
          calendarId: client.calendarId,
          event: eventInput,
        })
        await saveGoogleCalendarEventMapping({
          crm_type: 'activity',
          crm_id: activity.id,
          google_event_id: created.id,
        })
        syncedCount++
      }
    } catch (err) {
      console.error(`Error syncing activity ${activity.id}:`, err)
    }
  }

  // 2. Sync active deals with a next action
  const dealsToSync = workspace.deals.filter(
    (d) =>
      d.next &&
      d.next.trim().length > 0 &&
      d.next.toLowerCase() !== 'done' &&
      d.stage !== 'Won' &&
      d.stage !== 'Paid'
  )

  for (const deal of dealsToSync) {
    try {
      const eventInput = getDealNextEventInput(deal)
      const mapping = await getGoogleCalendarEventMapping(deal.id, 'deal')

      if (mapping) {
        try {
          await updateGoogleCalendarEvent({
            accessToken: client.accessToken,
            calendarId: client.calendarId,
            eventId: mapping.google_event_id,
            event: eventInput,
          })
          syncedCount++
        } catch (err: any) {
          if (String(err?.message || '').includes('404')) {
            const created = await createGoogleCalendarEvent({
              accessToken: client.accessToken,
              calendarId: client.calendarId,
              event: eventInput,
            })
            await saveGoogleCalendarEventMapping({
              crm_type: 'deal',
              crm_id: deal.id,
              google_event_id: created.id,
            })
            syncedCount++
          } else {
            console.error(`Failed to update deal ${deal.id} in Google Calendar:`, err)
          }
        }
      } else {
        const created = await createGoogleCalendarEvent({
          accessToken: client.accessToken,
          calendarId: client.calendarId,
          event: eventInput,
        })
        await saveGoogleCalendarEventMapping({
          crm_type: 'deal',
          crm_id: deal.id,
          google_event_id: created.id,
        })
        syncedCount++
      }
    } catch (err) {
      console.error(`Error syncing deal ${deal.id}:`, err)
    }
  }

  // 3. Update last_synced_at timestamp in integration settings
  const now = new Date().toISOString()
  await updateGoogleCalendarSettings({ last_synced_at: now })

  return {
    success: true,
    syncedCount,
  }
}

/**
 * Syncs a single activity to Google Calendar.
 */
export async function syncActivityToGoogleCalendar(
  activityId: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const workspace = await repo.getWorkspaceData()
  const activity = workspace.activities.find((a) => a.id === activityId)
  if (!activity) {
    throw new Error('Activity not found')
  }

  const client = await getAuthenticatedGoogleClient()
  if (!client) {
    return { success: false, error: 'Google Calendar is not connected' }
  }

  const eventInput = getActivityEventInput(activity)
  const mapping = await getGoogleCalendarEventMapping(activity.id, 'activity')

  let eventId: string
  if (mapping) {
    try {
      const updated = await updateGoogleCalendarEvent({
        accessToken: client.accessToken,
        calendarId: client.calendarId,
        eventId: mapping.google_event_id,
        event: eventInput,
      })
      eventId = updated.id
    } catch (err: any) {
      if (String(err?.message || '').includes('404')) {
        const created = await createGoogleCalendarEvent({
          accessToken: client.accessToken,
          calendarId: client.calendarId,
          event: eventInput,
        })
        await saveGoogleCalendarEventMapping({
          crm_type: 'activity',
          crm_id: activity.id,
          google_event_id: created.id,
        })
        eventId = created.id
      } else {
        throw err
      }
    }
  } else {
    const created = await createGoogleCalendarEvent({
      accessToken: client.accessToken,
      calendarId: client.calendarId,
      event: eventInput,
    })
    await saveGoogleCalendarEventMapping({
      crm_type: 'activity',
      crm_id: activity.id,
      google_event_id: created.id,
    })
    eventId = created.id
  }

  return { success: true, eventId }
}

/**
 * Deletes an activity's synced Google Calendar event and removes DB mapping.
 */
export async function deleteActivityFromGoogleCalendar(
  activityId: string
): Promise<{ success: boolean; error?: string }> {
  const mapping = await getGoogleCalendarEventMapping(activityId, 'activity')
  if (mapping) {
    const client = await getAuthenticatedGoogleClient()
    if (client) {
      try {
        await deleteGoogleCalendarEvent({
          accessToken: client.accessToken,
          calendarId: client.calendarId,
          eventId: mapping.google_event_id,
        })
      } catch (err) {
        console.warn(`Could not delete remote event ${mapping.google_event_id}:`, err)
      }
    }
    await deleteGoogleCalendarEventMapping(activityId, 'activity')
  }

  return { success: true }
}
