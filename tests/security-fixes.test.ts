import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Security Fixes', () => {
  describe('Database Error Masking & Sanitization', () => {
    it('masks raw SQLite and LibSQL errors from reaching the client', async () => {
      const { isDatabaseError, sanitizeErrorMessage } = await import('@/lib/errors')

      const rawSqliteErrors = [
        'SQLITE_CONSTRAINT: UNIQUE constraint failed: companies.name',
        'LibsqlError: SQLITE_BUSY: database is locked',
        'SQLITE_ERROR: no such table: deals',
        'SQLITE_ERROR: table deals has no column named secret_col',
        'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed',
        'near "SELECT": syntax error',
      ]

      for (const err of rawSqliteErrors) {
        assert.equal(isDatabaseError(err), true, `Should recognize "${err}" as database error`)
        const sanitized = sanitizeErrorMessage(new Error(err), 'Operation failed')
        assert.ok(!sanitized.includes('SQLITE'), `Sanitized error must not contain SQLITE: ${sanitized}`)
        assert.ok(!sanitized.includes('table'), `Sanitized error must not contain table names: ${sanitized}`)
        assert.ok(!sanitized.includes('Libsql'), `Sanitized error must not contain Libsql: ${sanitized}`)
      }
    })

    it('passes through safe user-facing validation errors unaltered', async () => {
      const { sanitizeErrorMessage } = await import('@/lib/errors')
      const userErr = 'Deal value cannot be negative'
      assert.equal(sanitizeErrorMessage(new Error(userErr)), userErr)
    })
  })
})
