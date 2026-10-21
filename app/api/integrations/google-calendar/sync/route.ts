import { NextResponse } from 'next/server'
import { syncAllToGoogleCalendar } from '@/lib/google-calendar/service'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllToGoogleCalendar()
    if (!result.success && result.error === 'Google Calendar is not connected') {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to sync Google Calendar') },
      { status: 500 }
    )
  }
}
