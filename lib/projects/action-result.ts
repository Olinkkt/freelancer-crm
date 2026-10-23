import { z } from 'zod'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'
import type { Suggestion } from './suggestions'

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DEAL_ALREADY_HAS_PROJECT'
  | 'STAGE_TRANSITION_NOT_ALLOWED'
  | 'USE_CLOSE_PROJECT'
  | 'USE_REOPEN_PROJECT'
  | 'ARCHIVE_NOT_ALLOWED'
  | 'INVOICES_UNRESOLVED'
  | 'INVOICE_TRANSITION_NOT_ALLOWED'
  | 'MILESTONE_TRANSITION_NOT_ALLOWED'
  | 'STAGE_IN_USE'
  | 'LAST_STAGE_IN_CATEGORY'
  | 'BUILTIN_TEMPLATE_READONLY'
  | 'SHORTCUT_CONFLICT'
  | 'SHORTCUT_LOCKED'
  | 'INTERNAL'

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

export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DomainError'
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
