import { ZodError } from 'zod'
import { sanitizeErrorMessage } from '@/lib/errors'
import { IdempotencyConflictError } from '@/lib/db/api-tokens'

export const API_ERROR_CODES = [
  'unauthorized',
  'insufficient_scope',
  'not_found',
  'validation_failed',
  'conflict',
  'rate_limited',
  'internal_error',
] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  insufficient_scope: 403,
  not_found: 404,
  validation_failed: 400,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
}

/** An error an agent can act on: a stable code, a message, and a hint for what to do next */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly field?: string
  readonly hint?: string

  constructor(code: ApiErrorCode, message: string, opts: { field?: string; hint?: string } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.field = opts.field
    this.hint = opts.hint
  }

  get status() {
    return STATUS[this.code]
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field ? { field: this.field } : {}),
        ...(this.hint ? { hint: this.hint } : {}),
      },
    }
  }
}

export const notFound = (what: string, id: string, hint?: string) =>
  new ApiError('not_found', `${what} "${id}" was not found`, {
    hint: hint ?? `Call search or list_${what.toLowerCase()}s to find the right id.`,
  })

/** Turns anything thrown during an operation into an ApiError (never leaks DB details) */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof ZodError) {
    const issue = err.issues[0]
    const field = issue?.path.join('.') || undefined
    return new ApiError('validation_failed', issue ? `${field ? `${field}: ` : ''}${issue.message}` : 'Invalid input', {
      field,
      hint: err.issues.length > 1 ? `${err.issues.length} fields are invalid; fix them all and retry.` : undefined,
    })
  }
  if (err instanceof IdempotencyConflictError) {
    return new ApiError('conflict', err.message, { hint: 'Use a new Idempotency-Key for each distinct write.' })
  }
  const message = sanitizeErrorMessage(err, 'Something went wrong')
  // Repository throws plain Errors for rule violations (e.g. "Client is required")
  if (err instanceof Error && message === err.message) {
    return new ApiError('validation_failed', message)
  }
  return new ApiError('internal_error', message)
}
