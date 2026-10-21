import { NextResponse } from 'next/server'
import {
  deleteGoogleCalendarIntegration,
  clearAllGoogleCalendarEventMappings,
} from '@/lib/db/google-calendar-repository'

export const dynamic = 'force-dynamic'

export async function POST() {
  await deleteGoogleCalendarIntegration()
  await clearAllGoogleCalendarEventMappings()
  return NextResponse.json({ success: true, disconnected: true })
}
