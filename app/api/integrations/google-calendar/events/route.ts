import { NextResponse } from 'next/server'
import { getAuthenticatedGoogleClient } from '@/lib/google-calendar/service'
import { listGoogleCalendarEvents } from '@/lib/google-calendar/client'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const client = await getAuthenticatedGoogleClient()
    if (!client) {
      return NextResponse.json({ events: [] })
    }

    const { searchParams } = new URL(req.url)
    const timeMin = searchParams.get('timeMin') || undefined
    const timeMax = searchParams.get('timeMax') || undefined

    const events = await listGoogleCalendarEvents({
      accessToken: client.accessToken,
      calendarId: client.calendarId,
      timeMin,
      timeMax,
    })

    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to fetch Google Calendar events') },
      { status: 500 }
    )
  }
}
