import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await repo.getWorkspaceData()
  return NextResponse.json(workspace.companies)
}

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const company = await repo.createCompany(body)
    return NextResponse.json(company, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create company' }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (!body?.id) {
      return NextResponse.json({ error: 'Missing company id' }, { status: 400 })
    }
    const company = await repo.updateCompany(body)
    return NextResponse.json(company, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update company' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing company id parameter' }, { status: 400 })
    }
    const success = await repo.deleteCompany(id)
    return NextResponse.json({ success, id }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete company' }, { status: 400 })
  }
}

