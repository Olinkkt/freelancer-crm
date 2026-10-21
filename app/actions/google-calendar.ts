'use server'

import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'
import {
  getGoogleIntegrationStatus,
  syncAllToGoogleCalendar,
  syncActivityToGoogleCalendar,
  deleteActivityFromGoogleCalendar,
  getActivityWebLink,
} from '@/lib/google-calendar/service'
import {
  deleteGoogleCalendarIntegration,
  clearAllGoogleCalendarEventMappings,
} from '@/lib/db/google-calendar-repository'
import * as repo from '@/lib/db/repository'
import { GoogleCalendarStatusResponse, GoogleCalendarSyncResult } from '@/lib/google-calendar/types'

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
}

/**
 * Server action to get the current connection status of Google Calendar.
 */
export async function getGoogleCalendarStatusAction(): Promise<GoogleCalendarStatusResponse> {
  await assertAuth()
  try {
    return await getGoogleIntegrationStatus()
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to get Google Calendar status'))
  }
}

/**
 * Server action to disconnect Google Calendar integration and clear event mappings.
 */
export async function disconnectGoogleCalendarAction(): Promise<{ success: boolean }> {
  await assertAuth()
  try {
    await deleteGoogleCalendarIntegration()
    await clearAllGoogleCalendarEventMappings()
    return { success: true }
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to disconnect Google Calendar'))
  }
}

/**
 * Server action to trigger full push sync of activities and deal next-steps to Google Calendar.
 */
export async function triggerGoogleCalendarSyncAction(): Promise<GoogleCalendarSyncResult> {
  await assertAuth()
  try {
    return await syncAllToGoogleCalendar()
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to trigger Google Calendar sync'))
  }
}

/**
 * Server action to sync a single CRM activity to Google Calendar.
 */
export async function syncActivityToGoogleCalendarAction(
  activityId: string
): Promise<{ success: boolean; eventId?: string }> {
  await assertAuth()
  try {
    const result = await syncActivityToGoogleCalendar(activityId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to sync activity to Google Calendar')
    }
    return { success: true, eventId: result.eventId }
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to sync activity to Google Calendar'))
  }
}

/**
 * Server action to remove a CRM activity's synced event from Google Calendar.
 */
export async function deleteActivityFromGoogleCalendarAction(
  activityId: string
): Promise<{ success: boolean }> {
  await assertAuth()
  try {
    return await deleteActivityFromGoogleCalendar(activityId)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete activity from Google Calendar'))
  }
}

/**
 * Server action to generate an instant 1-click fallback Google Calendar web link for an activity.
 */
export async function generateActivityGoogleWebLinkAction(
  activityId: string
): Promise<{ url: string }> {
  await assertAuth()
  try {
    const workspace = await repo.getWorkspaceData()
    const activity = workspace.activities.find((a) => a.id === activityId)
    if (!activity) {
      throw new Error('Activity not found')
    }
    const url = getActivityWebLink(activity)
    return { url }
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to generate Google Calendar web link'))
  }
}
