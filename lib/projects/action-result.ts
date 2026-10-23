import { z } from 'zod'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'
import type { Suggestion } from './suggestions'
import { DomainError, type ErrorCode } from './errors'

export { DomainError }
export type { ErrorCode }

export type ActionResult<T> =
  | { ok: true; data: T; suggestions: Suggestion[] }
  | {
      ok: false
      error: {
        code: ErrorCode
        message: string
        details?: Record<string, unknown>
      }
    }

export async function runAction<S extends z.ZodTypeAny, T>(
  schema: S,
  input: z.input<S>,
  fn: (data: z.output<S>) => Promise<{ data: T; suggestions?: Suggestion[] }>,
  fallback: string = 'Operation failed'
): Promise<ActionResult<T>> {
  try {
    const isAuthed = await checkIsAuthenticated()
    if (!isAuthed) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }
    }

    const parseResult = schema.safeParse(input)
    if (!parseResult.success) {
      const issues: Record<string, string> = {}
      for (const issue of parseResult.error.issues) {
        issues[issue.path.join('.')] = issue.message
      }
      return {
        ok: false,
        error: {
          code: 'VALIDATION',
          message: parseResult.error.issues[0]?.message || 'Validation failed',
          details: { issues },
        },
      }
    }

    const res = await fn(parseResult.data)
    return {
      ok: true,
      data: res.data,
      suggestions: res.suggestions ?? [],
    }
  } catch (err: any) {
    if (err instanceof DomainError) {
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      }
    }
    if (err && typeof err.code === 'string') {
      return {
        ok: false,
        error: {
          code: err.code as ErrorCode,
          message: err.message || 'Operation failed',
          details: err.details,
        },
      }
    }
    return {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: sanitizeErrorMessage(err, fallback),
      },
    }
  }
}
