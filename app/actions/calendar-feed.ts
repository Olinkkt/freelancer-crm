'use server'

import { headers } from 'next/headers'
import { checkIsAuthenticated } from '@/lib/auth/session'
import {
  getOrCreateCalendarFeedToken,
  regenerateCalendarFeedToken,
} from '@/lib/db/repository'
import { sanitizeErrorMessage } from '@/lib/errors'

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
}

async function getBaseOrigin(): Promise<string> {
  try {
    const headerList = await headers()
    const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3000'
    const proto = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  } catch {
    return 'http://localhost:3000'
  }
}

function buildFeedUrls(baseOrigin: string, token: string) {
  const feedUrl = `${baseOrigin}/api/calendar/feed/${token}`
  const webcalUrl = feedUrl.replace(/^https?:\/\//i, 'webcal://')
  const googleCalendarUrl = `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(
    feedUrl
  )}`

  return {
    token,
    feedUrl,
    webcalUrl,
    googleCalendarUrl,
  }
}

export interface CalendarFeedInfo {
  success: boolean
  token: string
  feedUrl: string
  webcalUrl: string
  googleCalendarUrl: string
}

export async function getCalendarFeedInfoAction(): Promise<CalendarFeedInfo> {
  await assertAuth()
  try {
    const token = await getOrCreateCalendarFeedToken()
    const origin = await getBaseOrigin()
    return {
      success: true,
      ...buildFeedUrls(origin, token),
    }
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to retrieve calendar feed URL'))
  }
}

export async function regenerateCalendarFeedTokenAction(): Promise<CalendarFeedInfo> {
  await assertAuth()
  try {
    const token = await regenerateCalendarFeedToken()
    const origin = await getBaseOrigin()
    return {
      success: true,
      ...buildFeedUrls(origin, token),
    }
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to regenerate calendar feed token'))
  }
}
