import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as pRepo from '@/lib/db/projects-repository'
import { createProjectInput } from '@/lib/validations/projects'
import { isIsoDate } from '@/lib/projects/dates'
import { DomainError } from '@/lib/projects/action-result'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    )
  }

  const url = new URL(req.url)
  const today = url.searchParams.get('today')
  const archivedParam = url.searchParams.get('archived')

  if (!today || !isIsoDate(today)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Invalid or missing today parameter (expected YYYY-MM-DD)' } },
      { status: 400 }
    )
  }

  const includeArchived = archivedParam === '1' || archivedParam === 'true'

  try {
    const cards = await pRepo.listProjectCards({ includeArchived, today })
    return NextResponse.json(cards, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: sanitizeErrorMessage(err, 'Failed to fetch projects') } },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const parseResult = createProjectInput.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION',
          message: parseResult.error.issues[0]?.message || 'Validation failed',
        },
      },
      { status: 400 }
    )
  }

  try {
    const now = new Date().toISOString()
    const detail = await pRepo.createProject(parseResult.data, now)
    return NextResponse.json(detail, { status: 201 })
  } catch (err: any) {
    if (err instanceof DomainError || err?.code) {
      const code = err.code || 'VALIDATION'
      const status = code === 'DEAL_ALREADY_HAS_PROJECT' ? 409 : code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json(
        { error: { code, message: err.message, details: err.details } },
        { status }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: sanitizeErrorMessage(err, 'Failed to create project') } },
      { status: 500 }
    )
  }
}
