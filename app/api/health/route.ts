import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sql } from 'kysely'

export const dynamic = 'force-dynamic'

export async function GET() {
  let dbStatus = 'connected'

  try {
    await sql`SELECT 1`.execute(db)
  } catch {
    dbStatus = 'degraded'
  }

  return NextResponse.json(
    {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      app: 'freelancer-crm',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    // 503 lets the Docker healthcheck notice a database that stopped answering
    { status: dbStatus === 'connected' ? 200 : 503 }
  )
}
