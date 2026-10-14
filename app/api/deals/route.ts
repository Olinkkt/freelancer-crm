import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { DealCreateInputSchema, DealUpdateInputSchema } from '@/lib/validations'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await repo.getWorkspaceData()
  return NextResponse.json(workspace.deals)
}

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const parsed = DealCreateInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal input', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const deal = await repo.createDeal(parsed.data as any)
    return NextResponse.json(deal, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to create deal') }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const parsed = DealUpdateInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal update input', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const deal = await repo.updateDeal(parsed.data as any)
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }
    return NextResponse.json(deal, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to update deal') }, { status: 400 })
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
      return NextResponse.json({ error: 'Missing deal id parameter' }, { status: 400 })
    }
    const success = await repo.deleteDeal(id)
    if (!success) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to delete deal') }, { status: 400 })
  }
}

