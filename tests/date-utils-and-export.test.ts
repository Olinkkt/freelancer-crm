import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getDateString,
  getFormattedToday,
  getDynamicGreeting,
  getWorkweekDays,
  formatWeekRange,
  matchMilestoneToWorkweek,
  getRelativeDayLabel,
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

    // "Tomorrow" + time -> Wed (idx 2) when Tue is today (idx 1) (#26)
    const tuesday = new Date(2026, 8, 22)
    const tuesdayDays = getWorkweekDays(0, tuesday)
    const matchTomorrow = matchMilestoneToWorkweek('Tomorrow 14:30', tuesdayDays)
    assert.ok(matchTomorrow)
    assert.equal(matchTomorrow.dayIndex, 2)
    assert.equal(matchTomorrow.startHour, 14.5)
  })

  it('matchMilestoneToWorkweek supports Czech date and time formats', () => {
    const tuesday = new Date(2026, 8, 22) // Tue Sep 22, 2026
    const days = getWorkweekDays(0, tuesday) // Mon Sep 21 - Fri Sep 25

    // Relative "dnes" -> Tue (idx 1)
    const matchDnes = matchMilestoneToWorkweek('dnes 14:30', days)
    assert.ok(matchDnes)
    assert.equal(matchDnes.dayIndex, 1)
    assert.equal(matchDnes.startHour, 14.5)

    // Relative "zítra" -> Wed (idx 2)
    const matchZitra = matchMilestoneToWorkweek('zítra v 10:00', days)
    assert.ok(matchZitra)
    assert.equal(matchZitra.dayIndex, 2)
    assert.equal(matchZitra.startHour, 10.0)

    // Relative "zitra" without diacritics and Czech preposition "ve 14"
    const matchZitraVe14 = matchMilestoneToWorkweek('zitra ve 14', days)
    assert.ok(matchZitraVe14)
    assert.equal(matchZitraVe14.dayIndex, 2)
    assert.equal(matchZitraVe14.startHour, 14.0)

    // Day names with and without diacritics
    const matchPo = matchMilestoneToWorkweek('pondělí 13:00', days)
    assert.ok(matchPo)
    assert.equal(matchPo.dayIndex, 0)
    assert.equal(matchPo.startHour, 13.0)

    const matchCt = matchMilestoneToWorkweek('čtvrtek 14.30', days)
    assert.ok(matchCt)
    assert.equal(matchCt.dayIndex, 3)
    assert.equal(matchCt.startHour, 14.5)

    const matchPa = matchMilestoneToWorkweek('pátek 09:00', days)
    assert.ok(matchPa)
    assert.equal(matchPa.dayIndex, 4)
    assert.equal(matchPa.startHour, 9.0)

    // Czech short day abbreviations: "st 11:00"
    const matchSt = matchMilestoneToWorkweek('st 11:00', days)
    assert.ok(matchSt)
    assert.equal(matchSt.dayIndex, 2)
    assert.equal(matchSt.startHour, 11.0)

    // Czech numerical date: "24.9." -> Thu Sep 24
    const matchCzechNumDate = matchMilestoneToWorkweek('24.9.', days)
    assert.ok(matchCzechNumDate)
    assert.equal(matchCzechNumDate.dayIndex, 3)

    // Czech numerical date with space and year: "21. 9. 2026 15:00" -> Mon Sep 21
    const matchCzechNumDateWithYear = matchMilestoneToWorkweek('21. 9. 2026 15:00', days)
    assert.ok(matchCzechNumDateWithYear)
    assert.equal(matchCzechNumDateWithYear.dayIndex, 0)
    assert.equal(matchCzechNumDateWithYear.startHour, 15.0)

    // Czech month name: "24. září 11:00" -> Thu Sep 24
    const matchCzechMonth = matchMilestoneToWorkweek('24. září 11:00', days)
    assert.ok(matchCzechMonth)
    assert.equal(matchCzechMonth.dayIndex, 3)
    assert.equal(matchCzechMonth.startHour, 11.0)

    // Czech numerical date outside active week -> null
    const matchOutsideCzech = matchMilestoneToWorkweek('15.10.', days)
    assert.equal(matchOutsideCzech, null)
  })

  it('getRelativeDayLabel correctly resolves relative day labels and handles missing years', () => {
    // Reference date: Wednesday Oct 14, 2026
    const ref = new Date(2026, 9, 14) // month 9 = Oct

    // Oct 14 -> Today
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 14), ref), 'Today')
    // Oct 15 -> Tomorrow
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 15), ref), 'Tomorrow')
    // Oct 16 -> This week
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 16), ref), 'This week')
    // Oct 18 (Sunday) -> This week
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 18), ref), 'This week')
    // Oct 21 (Next Wednesday) -> Next week, even when passed as 'Oct 21' without year
    assert.equal(getRelativeDayLabel('Oct 21', ref), 'Next week')
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 21), ref), 'Next week')
    // Oct 13 -> Overdue
    assert.equal(getRelativeDayLabel(new Date(2026, 9, 13), ref), 'Overdue')
    // Nov 15 -> Later
    assert.equal(getRelativeDayLabel(new Date(2026, 10, 15), ref), 'Later')
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
