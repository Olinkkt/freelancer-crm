import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateGoogleCalendarWebLink,
  formatToUtcCompact,
  formatToDateCompact,
  resolveEventDates,
  generateDealNextActionLink,
} from '../lib/calendar/web-links'

describe('Google Calendar Web Links (generateGoogleCalendarWebLink)', () => {
  it('generates a minimal template URL with only a title', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Review proposal',
    })

    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'))
    assert.ok(url.includes('action=TEMPLATE'))
    assert.ok(url.includes('text=Review%20proposal'))
    assert.ok(!url.includes('dates='))
    assert.ok(!url.includes('details='))
    assert.ok(!url.includes('location='))
  })

  it('formats timed events using compact UTC format (YYYYMMDDTHHmmssZ)', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Sprint Planning',
      startTime: '2026-10-21T10:00:00.000Z',
      endTime: '2026-10-21T11:30:00.000Z',
    })

    assert.ok(url.includes('dates=20261021T100000Z/20261021T113000Z'))
    // Slash separating start and end must remain literal, not percent-encoded
    assert.ok(!url.includes('20261021T100000Z%2F20261021T113000Z'))
  })

  it('defaults to 1 hour duration when endTime is not provided', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Client Check-in',
      startTime: '2026-10-21T14:00:00.000Z',
    })

    assert.ok(url.includes('dates=20261021T140000Z/20261021T150000Z'))
  })

  it('supports custom addHourDuration when endTime is not provided', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Workshop',
      startTime: '2026-10-21T09:00:00.000Z',
      addHourDuration: 3,
    })

    assert.ok(url.includes('dates=20261021T090000Z/20261021T120000Z'))
  })

  it('formats all-day events with date parameter (YYYYMMDD/YYYYMMDD)', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Invoice Due',
      date: '2026-10-21',
    })

    // Single-day all-day event ends next day in Google Calendar
    assert.ok(url.includes('dates=20261021/20261022'))
  })

  it('handles multi-day all-day events', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Design Offsite',
      date: '2026-10-21',
      endTime: '2026-10-24',
    })

    assert.ok(url.includes('dates=20261021/20261024'))
  })

  it('combines date with time-only startTime string', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Demo Call',
      date: '2026-10-21',
      startTime: '15:30',
      addHourDuration: 1,
    })

    assert.ok(url.includes('dates=20261021T153000Z/20261021T163000Z'))
  })

  it('combines compact date (20261021) with time-only startTime (14:30) without downgrading to all-day', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Technical Interview',
      date: '20261021',
      startTime: '14:30',
      addHourDuration: 1,
    })

    assert.ok(url.includes('dates=20261021T143000Z/20261021T153000Z'))
  })

  it('handles already-compact date strings', () => {
    const urlTimed = generateGoogleCalendarWebLink({
      title: 'Quick Sync',
      startTime: '20261021T100000Z',
      endTime: '20261021T103000Z',
    })
    assert.ok(urlTimed.includes('dates=20261021T100000Z/20261021T103000Z'))

    const urlAllDay = generateGoogleCalendarWebLink({
      title: 'Public Holiday',
      date: '20261028',
    })
    assert.ok(urlAllDay.includes('dates=20261028/20261029'))
  })

  it('encodes details, location, and special unicode characters', () => {
    const url = generateGoogleCalendarWebLink({
      title: 'Contract Kickoff & Demo 🚀',
      details: 'Discussion notes:\n- Milestones\n- Rates & Terms',
      location: 'Prague, Karlín / Google Meet',
      date: '2026-10-21',
    })

    assert.ok(url.includes('text=Contract%20Kickoff%20%26%20Demo%20%F0%9F%9A%80'))
    assert.ok(url.includes('location=Prague%2C%20Karl%C3%ADn%20%2F%20Google%20Meet'))
    assert.ok(url.includes('details='))
    assert.ok(url.includes('Milestones'))
  })

  it('date utility helpers format dates correctly', () => {
    const d = new Date(Date.UTC(2026, 9, 21, 10, 0, 0)) // 2026-10-21 10:00 UTC
    assert.equal(formatToUtcCompact(d), '20261021T100000Z')
    assert.equal(formatToDateCompact(d), '20261021')
  })
})

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

describe('generateDealNextActionLink', () => {
  it('builds a timed event for an ISO due date with client and deal details', () => {
    const url = generateDealNextActionLink({
      title: 'Website rebuild',
      next: 'Send proposal',
      nextDueDate: '2026-11-12T10:00:00Z',
      contactName: 'Jana Nová',
      value: '25 000 Kč',
    })
    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'))
    assert.ok(url.includes(`text=${encodeURIComponent('Send proposal (Jana Nová)')}`))
    assert.ok(url.includes('dates=20261112T100000Z/20261112T110000Z'))
    assert.ok(url.includes(encodeURIComponent('Deal: Website rebuild')))
  })

  it('builds an all-day event for a date-only due date', () => {
    const url = generateDealNextActionLink({ title: 'Logo', next: 'Kickoff', nextDueDate: '2026-11-12' })
    assert.ok(url.includes('dates=20261112/20261113'))
    assert.ok(url.includes('text=Kickoff'))
  })
})
