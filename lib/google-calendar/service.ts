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
import { generateGoogleCalendarWebLink, resolveEventDates } from './web-links'
export { resolveEventDates }
import {
  GoogleCalendarIntegration,
  GoogleCalendarEventItem,
  GoogleCalendarEventInput,
  GoogleCalendarEventDateTime,
  GoogleCalendarStatusResponse,
  GoogleCalendarSyncResult,
} from './types'
import * as repo from '@/lib/db/repository'
import { Activity, Deal } from '@/lib/crm-types'
import { dealNeedsNextAction } from '@/lib/deals/next-action'

/**
 * In-flight token refresh promise de-duplication to prevent stampedes.
 */
let inFlightTokenRefresh: Promise<{
  accessToken: string
  calendarId: string
  integration: GoogleCalendarIntegration
} | null> | null = null

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
 * Uses promise de-duplication to prevent concurrent refresh stampedes.
 * Returns null if the token is already expired and cannot be refreshed.
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

  const now = Date.now()

  // If token is expired or expiring within 60 seconds, attempt refresh with promise de-duplication
  if (integration.token_expiry <= now + 60000) {
    if (inFlightTokenRefresh) {
      return await inFlightTokenRefresh
    }

    inFlightTokenRefresh = (async () => {
      const refreshToken = integration.refresh_token
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

      if (!refreshToken || !clientId || !clientSecret) {
        return null
      }

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
        console.error('Failed to refresh Google Calendar token:', err)
        return null
      }
    })().finally(() => {
      inFlightTokenRefresh = null
    })

    const refreshedClient = await inFlightTokenRefresh
    if (refreshedClient) {
      return refreshedClient
    }

    // If refresh failed and token is already expired, return null
    if (integration.token_expiry <= now) {
      return null
    }
  }

  return {
    accessToken: integration.access_token,
    calendarId: integration.calendar_id || 'primary',
    integration,
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
 * Upserts a Google Calendar event for a given CRM entity:
 * If mapped, tries PATCH. If remote event not found (404), recreates and updates mapping.
 * If not mapped, creates and saves mapping.
 * Returns the Google event ID.
 */
export async function upsertGoogleCalendarEvent(options: {
  client: { accessToken: string; calendarId: string }
  crmId: string
  crmType: string
  eventInput: GoogleCalendarEventInput
}): Promise<string> {
  const { client, crmId, crmType, eventInput } = options
  const mapping = await getGoogleCalendarEventMapping(crmId, crmType)

  if (mapping) {
    try {
      const updated = await updateGoogleCalendarEvent({
        accessToken: client.accessToken,
        calendarId: client.calendarId,
        eventId: mapping.google_event_id,
        event: eventInput,
      })
      return updated.id
    } catch (err: any) {
      if (String(err?.message || '').includes('404')) {
        const created = await createGoogleCalendarEvent({
          accessToken: client.accessToken,
          calendarId: client.calendarId,
          event: eventInput,
        })
        await saveGoogleCalendarEventMapping({
          crm_type: crmType,
          crm_id: crmId,
          google_event_id: created.id,
        })
        return created.id
      }
      throw err
    }
  }

  const created = await createGoogleCalendarEvent({
    accessToken: client.accessToken,
    calendarId: client.calendarId,
    event: eventInput,
  })
  await saveGoogleCalendarEventMapping({
    crm_type: crmType,
    crm_id: crmId,
    google_event_id: created.id,
  })
  return created.id
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
      await upsertGoogleCalendarEvent({
        client,
        crmId: activity.id,
        crmType: 'activity',
        eventInput,
      })
      syncedCount++
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
      dealNeedsNextAction(d)
  )

  for (const deal of dealsToSync) {
    try {
      const eventInput = getDealNextEventInput(deal)
      await upsertGoogleCalendarEvent({
        client,
        crmId: deal.id,
        crmType: 'deal',
        eventInput,
      })
      syncedCount++
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
  const eventId = await upsertGoogleCalendarEvent({
    client,
    crmId: activity.id,
    crmType: 'activity',
    eventInput,
  })

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
