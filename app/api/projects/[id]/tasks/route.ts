import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as pRepo from '@/lib/db/projects-repository'
import { createTaskInput } from '@/lib/validations/projects'
import { DomainError } from '@/lib/projects/action-result'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const taskBodySchema = createTaskInput.omit({ projectId: true })

export async function POST(
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

  const { id: projectId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const parseResult = taskBodySchema.safeParse(body)
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
    const task = await pRepo.createTask(
      {
        projectId,
        ...parseResult.data,
      },
      now
    )
    return NextResponse.json(task, { status: 201 })
  } catch (err: any) {
    if (err instanceof DomainError || err?.code) {
      const code = err.code || 'VALIDATION'
      const status = code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json(
        { error: { code, message: err.message, details: err.details } },
        { status }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: sanitizeErrorMessage(err, 'Failed to create task') } },
      { status: 500 }
    )
  }
}
