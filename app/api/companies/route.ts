import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { CompanyCreateInputSchema } from '@/lib/validations'
import { sanitizeErrorMessage } from '@/lib/errors'

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
    const rawBody = await req.json()
    const parsed = CompanyCreateInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid company input', details: parsed.error.format() },
        { status: 400 }
      )
    }
    const company = await repo.createCompany(parsed.data as any)
    return NextResponse.json(company, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to create company') }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (!body?.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Missing company id' }, { status: 400 })
    }
    const company = await repo.updateCompany(body)
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    return NextResponse.json(company, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to update company') }, { status: 400 })
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
    if (!success) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    return NextResponse.json({ success, id }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to delete company') }, { status: 400 })
  }
}

