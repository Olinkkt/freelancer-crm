import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { BackupPayloadSchema } from '@/lib/validations'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/backup
 * Downloads a complete portable JSON snapshot of the entire workspace.
 */
export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await repo.getWorkspaceData()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `freelancer-crm-backup-${timestamp}.json`

  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    ...workspace,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

/**
 * POST /api/backup
 * Restores or imports a JSON snapshot into the workspace.
 */
export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const parsed = BackupPayloadSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid backup payload structure', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const result = await repo.restoreWorkspaceData(parsed.data as any)
    return NextResponse.json({
      success: true,
      restored: result,
      message: 'Workspace restored successfully',
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to restore workspace backup') },
      { status: 500 }
    )
  }
}

