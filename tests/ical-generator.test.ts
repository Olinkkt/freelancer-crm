import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeIcsText,
  foldIcsLine,
  formatIcsUtcDateTime,
  formatIcsDateOnly,
  generateIcsCalendar,
} from '../lib/calendar/ical-generator'
import { Deal } from '../lib/crm-types'

describe('iCalendar (RFC 5545) Generator', () => {
  describe('escapeIcsText', () => {
    it('escapes backslashes, semicolons, commas, and newlines', () => {
      const input = 'Notes:\nPath: C:\\Work; Items: apple, banana\r\nDone.'
      const escaped = escapeIcsText(input)
      assert.equal(escaped, 'Notes:\\nPath: C:\\\\Work\\; Items: apple\\, banana\\nDone.')
    })

    it('returns empty string for null or empty input', () => {
      assert.equal(escapeIcsText(''), '')
      assert.equal(escapeIcsText(null as any), '')
    })
  })

  describe('foldIcsLine', () => {
    it('does not fold lines <= 75 characters', () => {
      const short = 'SUMMARY:Meeting with Alex Rivera'
      assert.equal(foldIcsLine(short), short)
    })

    it('folds lines exceeding 75 characters with CRLF and leading space', () => {
      const long =
        'DESCRIPTION:This is a very long description that definitely exceeds seventy five characters and must be folded per RFC 5545 specification.'
      const folded = foldIcsLine(long)
      assert.ok(folded.includes('\r\n '))
      const unfolded = folded.replace(/\r\n /g, '')
      assert.equal(unfolded, long)
    })
  })

  describe('formatIcsUtcDateTime & formatIcsDateOnly', () => {
    it('formats ISO datetime to compact UTC format: YYYYMMDDTHHmmssZ', () => {
      const formatted = formatIcsUtcDateTime('2026-10-25T14:30:00.000Z')
      assert.equal(formatted, '20261025T143000Z')
    })

    it('formats date only string YYYY-MM-DD to YYYYMMDD', () => {
      assert.equal(formatIcsDateOnly('2026-11-05'), '20261105')
    })
  })

  describe('generateIcsCalendar', () => {
    it('generates an empty valid VCALENDAR when no items are provided', () => {
      const ics = generateIcsCalendar({
        calendarName: 'My Freelance Workspace',
        calendarDescription: 'Client deliverables',
        now: new Date('2026-10-21T12:00:00Z'),
      })

      assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
      assert.ok(ics.includes('VERSION:2.0\r\n'))
      assert.ok(ics.includes('PRODID:-//Freelancer CRM//Calendar Feed//EN\r\n'))
      assert.ok(ics.includes('X-WR-CALNAME:My Freelance Workspace\r\n'))
      assert.ok(ics.includes('X-WR-CALDESC:Client deliverables\r\n'))
      assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
      assert.ok(!ics.includes('BEGIN:VEVENT'))
    })

    it('includes deal next actions and omits deals with no due date or a completed one', () => {
      const deals: Deal[] = [
        {
          id: 'deal-1',
          title: 'Design System Overhaul',
          contactName: 'Jane Doe',
          value: '$12,000',
          rawAmount: 12000,
          stage: 'Proposal',
          next: 'Submit Phase 1 wireframes',
          nextDueDate: '2026-11-05',
          color: 'blue',
        },
        {
          id: 'deal-done',
          title: 'Old Contract',
          contactName: 'Finished Corp',
          value: '$5,000',
          rawAmount: 5000,
          stage: 'Closed',
          next: 'Invoice settlement',
          nextDueDate: 'Done',
          color: 'green',
        },
      ]

      const ics = generateIcsCalendar({
        deals,
        now: new Date('2026-10-21T12:00:00Z'),
      })

      assert.ok(ics.includes('BEGIN:VEVENT\r\n'))
      assert.ok(ics.includes('UID:deal-milestone-deal-1@freelancercrm.local\r\n'))
      assert.ok(ics.includes('SUMMARY:Milestone: Submit Phase 1 wireframes (Jane Doe)\r\n'))
      assert.ok(ics.includes('DTSTART;VALUE=DATE:20261105\r\n'))
      assert.ok(ics.includes('DTEND;VALUE=DATE:20261106\r\n'))
      assert.ok(ics.includes('CATEGORIES:Milestone,Freelancer CRM\r\n'))

      // A next action marked Done should be excluded
      assert.ok(!ics.includes('deal-done'))
      assert.ok(!ics.includes('Finished Corp'))
    })
  })
})
