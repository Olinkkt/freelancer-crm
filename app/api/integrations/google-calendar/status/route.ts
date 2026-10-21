import { NextResponse } from 'next/server'
import { getGoogleIntegrationStatus } from '@/lib/google-calendar/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getGoogleIntegrationStatus()
  return NextResponse.json(status)
}
