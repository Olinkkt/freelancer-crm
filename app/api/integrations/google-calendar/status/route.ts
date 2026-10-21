import { NextResponse } from 'next/server'
import { getGoogleIntegrationStatus } from '@/lib/google-calendar/service'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = await getGoogleIntegrationStatus()
    return NextResponse.json(status)
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to get Google Calendar integration status') },
      { status: 500 }
    )
  }
}
