import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sql } from 'kysely'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbStatus = 'connected'

  try {
    await sql`SELECT 1`.execute(db)
  } catch (err: any) {
    dbStatus = `degraded: ${err?.message || 'unknown'}`
  }

  return NextResponse.json(
    {
      status: 'healthy',
      app: 'freelancer-crm',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 }
  )
}
