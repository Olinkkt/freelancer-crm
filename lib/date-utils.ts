import { DayColumn } from '@/components/calendar/types'

/**
 * Returns date in YYYY-MM-DD format based on local time
 */
export function getDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Formats a date into "DayOfWeek, Month Day, Year" (e.g. "Friday, September 25, 2026")
 */
export function getFormattedToday(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Returns dynamic greeting based on the current hour:
 * - < 12: Good morning
 * - 12 - 17: Good afternoon
 * - >= 18: Good evening
 */
export function getDynamicGreeting(name: string = 'Oliver', date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) {
    return `Good morning, ${name}.`
  }
  if (hour < 18) {
    return `Good afternoon, ${name}.`
  }
  return `Good evening, ${name}.`
}

/**
 * Generates Monday - Friday DayColumn array for any given weekOffset (0 = current week, -1 = last week, +1 = next week)
 */
export function getWorkweekDays(weekOffset: number = 0, now: Date = new Date()): DayColumn[] {
  const currentDay = now.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay

  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + distanceToMonday + weekOffset * 7
  )
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI']
  const todayStr = getDateString(now)

  return dayNames.map((name, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx)
    const dateStr = getDateString(d)
    return {
      dayNumber: String(d.getDate()),
      dayName: name,
      fullDate: d,
      isToday: dateStr === todayStr,
      isBlockedAfterHour: idx === 4 ? 13 : undefined, // Friday afternoon shaded pattern
    }
  })
}

/**
 * Formats Monday–Friday range, e.g. "Sep 21 – Sep 25, 2026" or "Sep 28 – Oct 2, 2026"
 */
export function formatWeekRange(days: { fullDate: Date }[]): string {
  if (days.length === 0) return ''
  const first = days[0].fullDate
  const last = days[days.length - 1].fullDate
  const firstMonth = first.toLocaleDateString('en-US', { month: 'short' })
  const lastMonth = last.toLocaleDateString('en-US', { month: 'short' })
  const firstYear = first.getFullYear()
  const lastYear = last.getFullYear()

  if (firstYear !== lastYear) {
    return `${firstMonth} ${first.getDate()}, ${firstYear} – ${lastMonth} ${last.getDate()}, ${lastYear}`
  }
  if (firstMonth !== lastMonth) {
    return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}, ${firstYear}`
  }
  return `${firstMonth} ${first.getDate()} – ${last.getDate()}, ${firstYear}`
}

/**
 * Matches a deal's nextDueDate string against the active workweek's days.
 * Returns dayIndex (0-4), dateString, and startHour, or null if outside this week.
 */
export function matchMilestoneToWorkweek(
  dueDateStr: string,
  days: DayColumn[]
): { dayIndex: number; dateString: string; startHour: number } | null {
  if (!dueDateStr || dueDateStr.toLowerCase() === 'done') return null
  const due = dueDateStr.toLowerCase().trim()

  // 1. Check for exact ISO date (YYYY-MM-DD)
  const isoMatch = due.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoMatch) {
    const targetIso = isoMatch[1]
    const idx = days.findIndex((d) => getDateString(d.fullDate) === targetIso)
    if (idx !== -1) {
      return {
        dayIndex: idx,
        dateString: targetIso,
        startHour: extractStartHour(due, 10.0),
      }
    }
    return null
  }

  // 2. Relative "today"
  if (due.includes('today')) {
    const todayIdx = days.findIndex((d) => d.isToday)
    if (todayIdx !== -1) {
      return {
        dayIndex: todayIdx,
        dateString: getDateString(days[todayIdx].fullDate),
        startHour: extractStartHour(due, 11.5),
      }
    }
    return null
  }

  // 3. Relative "tomorrow"
  if (due.includes('tomorrow')) {
    const todayIdx = days.findIndex((d) => d.isToday)
    if (todayIdx !== -1 && todayIdx + 1 < days.length) {
      return {
        dayIndex: todayIdx + 1,
        dateString: getDateString(days[todayIdx + 1].fullDate),
        startHour: extractStartHour(due, 9.0),
      }
    }
    return null
  }

  // 4. Day names (mon, tue, wed, thu, fri)
  const dayKeywords = [
    { key: 'mon', idx: 0 },
    { key: 'tue', idx: 1 },
    { key: 'wed', idx: 2 },
    { key: 'thu', idx: 3 },
    { key: 'fri', idx: 4 },
  ]
  for (const { key, idx } of dayKeywords) {
    if (due.includes(key)) {
      return {
        dayIndex: idx,
        dateString: getDateString(days[idx].fullDate),
        startHour: extractStartHour(due, 10.0),
      }
    }
  }

  // 5. Month + day string matching, e.g. "sep 22", "sep 25", "oct 2"
  for (let i = 0; i < days.length; i++) {
    const d = days[i].fullDate
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase()
    const dayNum = String(d.getDate())
    if (due.includes(`${monthShort} ${dayNum}`) || due.includes(`${monthShort}. ${dayNum}`)) {
      return {
        dayIndex: i,
        dateString: getDateString(d),
        startHour: extractStartHour(due, 10.0),
      }
    }
  }

  // Default fallback if milestone has generic string: align to today (if in current week) or Tuesday (index 1)
  const todayIdx = days.findIndex((d) => d.isToday)
  const targetIdx = todayIdx !== -1 ? todayIdx : 1
  return {
    dayIndex: targetIdx,
    dateString: getDateString(days[targetIdx].fullDate),
    startHour: extractStartHour(due, 10.0),
  }
}

/**
 * Extracts start hour decimal (e.g. 14.5 for 14:30) or returns fallback
 */
function extractStartHour(due: string, defaultHour: number): number {
  if (due.includes('14:30') || due.includes('2:30')) return 14.5
  if (due.includes('10:00') || due.includes('10 am')) return 10.0
  if (due.includes('09:00') || due.includes('9 am') || due.includes('9:00')) return 9.0
  if (due.includes('11:00') || due.includes('11 am')) return 11.0
  if (due.includes('13:00') || due.includes('1 pm') || due.includes('1:00')) return 13.0
  if (due.includes('15:00') || due.includes('3 pm')) return 15.0

  const timeMatch = due.match(/\b(\d{1,2}):(\d{2})\b/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10)
    const m = parseInt(timeMatch[2], 10)
    if (h >= 9 && h <= 15) {
      return h + Math.round(m / 15) * 0.25
    }
  }
  return defaultHour
}
