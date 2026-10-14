/**
 * Database and application error sanitization utilities.
 * Ensures internal database engine details (SQLite, LibSQL, SQL queries, schema identifiers)
 * are never leaked to the client.
 */

const DB_ERROR_PATTERNS = [
  /sqlite/i,
  /libsql/i,
  /constraint failed/i,
  /unique constraint/i,
  /foreign key constraint/i,
  /check constraint/i,
  /not null constraint/i,
  /no such table/i,
  /no such column/i,
  /syntax error/i,
  /database is locked/i,
  /table .+ has no column/i,
  /\bselect\b.+\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bdelete\s+from\b/i,
  /\bupdate\s+.+\s+set\b/i,
  /pragma/i,
]

export function isDatabaseError(err: unknown): boolean {
  if (!err) return false
  const msg = typeof err === 'string' ? err : (err as any)?.message || String(err)
  return DB_ERROR_PATTERNS.some((pattern) => pattern.test(msg))
}

export function sanitizeErrorMessage(err: unknown, fallbackMessage: string = 'A database error occurred'): string {
  if (!err) return fallbackMessage

  const msg = typeof err === 'string' ? err : (err as any)?.message
  if (!msg || typeof msg !== 'string') return fallbackMessage

  if (isDatabaseError(msg)) {
    if (/unique constraint/i.test(msg)) {
      return 'A record with this information already exists.'
    }
    if (/foreign key constraint/i.test(msg)) {
      return 'Referenced record was not found or is in use.'
    }
    return fallbackMessage
  }

  return msg
}

export function sanitizeError(err: unknown, fallbackMessage: string = 'A database error occurred'): Error {
  if (err instanceof Error && !isDatabaseError(err)) {
    return err
  }
  return new Error(sanitizeErrorMessage(err, fallbackMessage))
}
