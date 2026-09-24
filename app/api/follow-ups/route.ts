import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await repo.getWorkspaceData()
  return NextResponse.json(workspace.followUps)
}

export async function PATCH(req: Request) {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing follow-up id' }, { status: 400 })
    }
    const completed = await repo.toggleFollowUp(id)
    return NextResponse.json({ id, completed }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to toggle follow up' }, { status: 400 })
  }
}
