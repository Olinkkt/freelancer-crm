import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEventDates } from '../lib/calendar/web-links'

describe('resolveEventDates utility', () => {
  it('handles standard ISO dateTime strings (RFC3339)', () => {
    const res = resolveEventDates('2026-10-25T14:00:00.000Z')
    assert.equal(res.start.dateTime, '2026-10-25T14:00:00.000Z')
    assert.equal(res.end.dateTime, '2026-10-25T15:00:00.000Z')
    assert.equal(res.start.date, undefined)
  })

  it('handles all-day date strings formatted as YYYY-MM-DD', () => {
    const res = resolveEventDates('2026-11-05')
    assert.equal(res.start.date, '2026-11-05')
    assert.equal(res.end.date, '2026-11-06')
    assert.equal(res.start.dateTime, undefined)
  })

  it('handles relative natural strings such as "Tomorrow, 10:00"', () => {
    const res = resolveEventDates('Tomorrow, 10:00')
    assert.ok(res.start.dateTime)
    assert.ok(res.end.dateTime)
  })

  it('falls back to a default 1-hour window starting now when input is empty or null', () => {
    const res = resolveEventDates(null)
    assert.ok(res.start.dateTime)
    assert.ok(res.end.dateTime)
    const startTime = new Date(res.start.dateTime!).getTime()
    const endTime = new Date(res.end.dateTime!).getTime()
    assert.equal(endTime - startTime, 3600000)
  })
})
