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
  return NextResponse.json(workspace.contacts)
}

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const contact = await repo.createContact(body)
    return NextResponse.json(contact, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create contact' }, { status: 400 })
  }
}
