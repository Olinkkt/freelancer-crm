import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getDateString,
  getFormattedToday,
  getDynamicGreeting,
  getWorkweekDays,
  formatWeekRange,
  matchMilestoneToWorkweek,
} from '../lib/date-utils'
import { generateCSV } from '../lib/csv-export'
import { Deal, Company, Contact, Activity, FollowUpItem } from '../lib/crm-types'

describe('Date Utilities & Workweek Navigation', () => {
  it('getDateString formats dates as YYYY-MM-DD', () => {
    const d = new Date(2026, 8, 25) // Sep 25, 2026
    assert.equal(getDateString(d), '2026-09-25')
  })

  it('getFormattedToday formats full localized string', () => {
    const d = new Date(2026, 8, 25) // Friday
    const str = getFormattedToday(d)
    assert.match(str, /Friday/i)
    assert.match(str, /September/i)
    assert.match(str, /25/i)
    assert.match(str, /2026/i)
  })

  it('getDynamicGreeting changes greeting according to time of day', () => {
    const morning = new Date(2026, 8, 25, 9, 30)
    assert.equal(getDynamicGreeting('Oliver', morning), 'Good morning, Oliver.')

    const afternoon = new Date(2026, 8, 25, 14, 15)
    assert.equal(getDynamicGreeting('Oliver', afternoon), 'Good afternoon, Oliver.')

    const evening = new Date(2026, 8, 25, 19, 45)
    assert.equal(getDynamicGreeting('Oliver', evening), 'Good evening, Oliver.')
  })

  it('getWorkweekDays calculates Monday through Friday', () => {
    // Sep 25, 2026 is a Friday
    const friday = new Date(2026, 8, 25)
    const days = getWorkweekDays(0, friday)

    assert.equal(days.length, 5)
    assert.equal(days[0].dayName, 'MON')
    assert.equal(days[0].dayNumber, '21') // Mon Sep 21
    assert.equal(days[4].dayName, 'FRI')
    assert.equal(days[4].dayNumber, '25') // Fri Sep 25
    assert.equal(days[4].isToday, true)
    assert.equal(days[0].isToday, false)
  })

  it('getWorkweekDays shifts correctly with weekOffset', () => {
    const friday = new Date(2026, 8, 25)
    const nextWeekDays = getWorkweekDays(1, friday)
    assert.equal(nextWeekDays[0].dayName, 'MON')
    assert.equal(nextWeekDays[0].dayNumber, '28') // Mon Sep 28
    assert.equal(nextWeekDays[4].dayNumber, '2')  // Fri Oct 2

    const prevWeekDays = getWorkweekDays(-1, friday)
    assert.equal(prevWeekDays[0].dayName, 'MON')
    assert.equal(prevWeekDays[0].dayNumber, '14') // Mon Sep 14
  })

  it('formatWeekRange formats single-month and cross-month week spans', () => {
    const sameMonthDays = [
      { fullDate: new Date(2026, 8, 21) },
      { fullDate: new Date(2026, 8, 25) },
    ]
    assert.equal(formatWeekRange(sameMonthDays), 'Sep 21 – 25, 2026')

    const crossMonthDays = [
      { fullDate: new Date(2026, 8, 28) },
      { fullDate: new Date(2026, 9, 2) },
    ]
    assert.equal(formatWeekRange(crossMonthDays), 'Sep 28 – Oct 2, 2026')
  })

  it('matchMilestoneToWorkweek handles relative and absolute due dates', () => {
    const friday = new Date(2026, 8, 25)
    const days = getWorkweekDays(0, friday) // Sep 21 - Sep 25

    // "today" -> Fri (idx 4)
    const matchToday = matchMilestoneToWorkweek('Today, 14:30', days)
    assert.ok(matchToday)
    assert.equal(matchToday.dayIndex, 4)
    assert.equal(matchToday.startHour, 14.5)

    // ISO date in week -> Tue Sep 22
    const matchIso = matchMilestoneToWorkweek('2026-09-22', days)
    assert.ok(matchIso)
    assert.equal(matchIso.dayIndex, 1)

    // ISO date outside week -> null
    const matchOutside = matchMilestoneToWorkweek('2026-10-15', days)
    assert.equal(matchOutside, null)

    // Day name "thu" -> idx 3
    const matchThu = matchMilestoneToWorkweek('Thu, 11:00', days)
    assert.ok(matchThu)
    assert.equal(matchThu.dayIndex, 3)
    assert.equal(matchThu.startHour, 11.0)
  })
})

describe('CSV Generation & Data Export', () => {
  it('generateCSV correctly escapes quotes, commas, and handles nulls', () => {
    const sampleData = [
      {
        id: '1',
        title: 'Project "Alpha", Redesign',
        value: '120,000 Kč',
        notes: null,
      },
    ]

    const headers = [
      { key: 'id' as const, label: 'ID' },
      { key: 'title' as const, label: 'Project Title' },
      { key: 'value' as const, label: 'Value' },
      { key: 'notes' as const, label: 'Notes' },
    ]

    const csv = generateCSV(sampleData, headers)
    const lines = csv.split('\n')
    assert.equal(lines.length, 2)
    assert.equal(lines[0], '"ID","Project Title","Value","Notes"')
    assert.equal(lines[1], '"1","Project ""Alpha"", Redesign","120,000 Kč",""')
  })

  it('generates well-formed CSV for CRM deals collection', () => {
    const mockDeals: Partial<Deal>[] = [
      {
        id: 'deal-1',
        title: 'Brand Refresh',
        company: 'Vortex Labs',
        value: '45,000 Kč',
        stage: 'Lead In' as any,
        probability: '25%',
        next: 'Send brief draft',
      },
    ]

    const headers = [
      { key: 'id' as keyof Deal, label: 'Deal ID' },
      { key: 'title' as keyof Deal, label: 'Title' },
      { key: 'company' as keyof Deal, label: 'Company' },
      { key: 'stage' as keyof Deal, label: 'Stage' },
    ]

    const csv = generateCSV(mockDeals, headers)
    assert.match(csv, /"Deal ID","Title","Company","Stage"/)
    assert.match(csv, /"deal-1","Brand Refresh","Vortex Labs","Lead In"/)
  })
})
