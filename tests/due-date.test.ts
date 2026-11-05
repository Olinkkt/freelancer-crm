import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDueDate, formatDue, isOverdue, daysUntil } from '../lib/due-date'

// Wed 2026-11-04, local time
const now = new Date(2026, 10, 4, 12, 0, 0)

describe('due-date', () => {
  it('normalizes legacy free text to ISO dates', () => {
    assert.equal(normalizeDueDate('Tomorrow, 10:00', now), '2026-11-05')
    assert.equal(normalizeDueDate('Today 17:00', now), '2026-11-04')
    assert.equal(normalizeDueDate('In 3 days', now), '2026-11-07')
    assert.equal(normalizeDueDate('Next Monday 09:30', now), '2026-11-09')
    assert.equal(normalizeDueDate('This week', now), '2026-11-06')
    assert.equal(normalizeDueDate('2026-12-01T10:00:00Z', now), '2026-12-01')
    assert.equal(normalizeDueDate('2026-12-01', now), '2026-12-01')
  })

  it('returns null for empty, done or unreadable input', () => {
    assert.equal(normalizeDueDate('', now), null)
    assert.equal(normalizeDueDate(undefined, now), null)
    assert.equal(normalizeDueDate('Done', now), null)
    assert.equal(normalizeDueDate('someday', now), null)
  })

  it('formats and detects overdue', () => {
    assert.equal(formatDue('2026-11-04', now), 'Today')
    assert.equal(formatDue('2026-11-05', now), 'Tomorrow')
    assert.equal(formatDue('2026-11-01', now), '3 days overdue')
    assert.equal(formatDue('Tomorrow, 10:00', now), 'Tomorrow, 10:00')
    assert.equal(isOverdue('2026-11-03', now), true)
    assert.equal(isOverdue('2026-11-04', now), false)
    assert.equal(daysUntil('2026-11-07', now), 3)
  })
})
