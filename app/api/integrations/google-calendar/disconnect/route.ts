import { NextResponse } from 'next/server'
import {
  deleteGoogleCalendarIntegration,
  clearAllGoogleCalendarEventMappings,
} from '@/lib/db/google-calendar-repository'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await deleteGoogleCalendarIntegration()
    await clearAllGoogleCalendarEventMappings()
    return NextResponse.json({ success: true, disconnected: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to disconnect Google Calendar integration') },
      { status: 500 }
    )
  }
}
