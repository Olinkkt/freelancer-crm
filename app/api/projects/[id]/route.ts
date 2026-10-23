import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as pRepo from '@/lib/db/projects-repository'
import { isIsoDate } from '@/lib/projects/dates'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    )
  }

  const { id } = await params
  const url = new URL(req.url)
  const todayParam = url.searchParams.get('today')
  const today = todayParam && isIsoDate(todayParam) ? todayParam : new Date().toISOString().slice(0, 10)

  try {
    const detail = await pRepo.getProjectDetail(id, today)
    if (!detail) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Project ${id} not found` } },
        { status: 404 }
      )
    }
    return NextResponse.json(detail, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: sanitizeErrorMessage(err, 'Failed to fetch project detail') } },
      { status: 500 }
    )
  }
}
