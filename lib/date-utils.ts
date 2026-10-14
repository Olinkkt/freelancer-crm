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
 * Strips diacritics / accents from text (e.g. "pondělí" -> "pondeli")
 */
export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Checks whether a due date string indicates "today" (supports English & Czech)
 */
export function isDueToday(dueDate?: string | null): boolean {
  if (!dueDate) return false
  const norm = stripDiacritics(dueDate.toLowerCase())
  return /\b(today|dnes|dneska)\b/i.test(norm)
}

const CZECH_MONTHS: Record<number, string[]> = {
  1: ['leden', 'ledna', 'led'],
  2: ['unor', 'unora', 'uno'],
  3: ['brezen', 'brezna', 'bre'],
  4: ['duben', 'dubna', 'dub'],
  5: ['kveten', 'kvetna', 'kve'],
  6: ['cerven', 'cervna', 'cer'],
  7: ['cervenec', 'cervence', 'cvc'],
  8: ['srpen', 'srpna', 'srp'],
  9: ['zari', 'zar'],
  10: ['rijen', 'rijna', 'rij'],
  11: ['listopad', 'listopadu', 'lis'],
  12: ['prosinec', 'prosince', 'pro'],
}

/**
 * Matches a deal's nextDueDate string against the active workweek's days.
 * Supports English and Czech natural expressions, ISO dates, and Czech dot formats.
 * Returns dayIndex (0-4), dateString, and startHour, or null if outside this week.
 */
export function matchMilestoneToWorkweek(
  dueDateStr: string,
  days: DayColumn[]
): { dayIndex: number; dateString: string; startHour: number } | null {
  if (!dueDateStr || dueDateStr.toLowerCase() === 'done') return null
  const due = dueDateStr.toLowerCase().trim()
  const dueNorm = stripDiacritics(due)

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

  // 2. Check for Czech numeric date format (DD.MM. or DD. MM. or DD.MM.YYYY)
  const czechDateMatch = due.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/)
  if (czechDateMatch) {
    const dayNum = parseInt(czechDateMatch[1], 10)
    const monthNum = parseInt(czechDateMatch[2], 10)
    const yearNum = czechDateMatch[3] ? parseInt(czechDateMatch[3], 10) : undefined

    const idx = days.findIndex((d) => {
      const fd = d.fullDate
      const matchDayMonth = fd.getDate() === dayNum && fd.getMonth() + 1 === monthNum
      return yearNum ? matchDayMonth && fd.getFullYear() === yearNum : matchDayMonth
    })

    if (idx !== -1) {
      return {
        dayIndex: idx,
        dateString: getDateString(days[idx].fullDate),
        startHour: extractStartHour(due, 10.0),
      }
    }
    return null
  }

  // 3. Relative "today" / "dnes" / "dneska"
  if (/\b(today|dnes|dneska)\b/i.test(dueNorm)) {
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

  // 4. Relative "tomorrow" / "zítra" / "zitra" / "zitrek"
  if (/\b(tomorrow|zitra|zitrek)\b/i.test(dueNorm)) {
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

  // 5. Relative "in 2 days" / "pozitri" / "za 2 dny"
  if (/\b(pozitri|pozitrek)\b/i.test(dueNorm) || dueNorm.includes('in 2 days') || dueNorm.includes('za 2 dny')) {
    const todayIdx = days.findIndex((d) => d.isToday)
    if (todayIdx !== -1 && todayIdx + 2 < days.length) {
      return {
        dayIndex: todayIdx + 2,
        dateString: getDateString(days[todayIdx + 2].fullDate),
        startHour: extractStartHour(due, 10.0),
      }
    }
    return null
  }

  // 6. Day names (English and Czech)
  const dayKeywords = [
    { regex: /\b(mon|monday|pondeli|po)\b/i, idx: 0 },
    { regex: /\b(tue|tuesday|utery|ut)\b/i, idx: 1 },
    { regex: /\b(wed|wednesday|streda|st)\b/i, idx: 2 },
    { regex: /\b(thu|thursday|ctvrtek|ct)\b/i, idx: 3 },
    { regex: /\b(fri|friday|patek|pa)\b/i, idx: 4 },
  ]
  for (const { regex, idx } of dayKeywords) {
    if (regex.test(dueNorm)) {
      return {
        dayIndex: idx,
        dateString: getDateString(days[idx].fullDate),
        startHour: extractStartHour(due, 10.0),
      }
    }
  }

  // 7. Month + day string matching (English & Czech)
  for (let i = 0; i < days.length; i++) {
    const d = days[i].fullDate
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' }).toLowerCase()
    const dayNum = String(d.getDate())
    const monthNum = d.getMonth() + 1

    // English: "sep 22", "sep. 22", "22 sep"
    if (
      dueNorm.includes(`${monthShort} ${dayNum}`) ||
      dueNorm.includes(`${monthShort}. ${dayNum}`) ||
      dueNorm.includes(`${dayNum} ${monthShort}`) ||
      dueNorm.includes(`${dayNum}. ${monthShort}`)
    ) {
      return {
        dayIndex: i,
        dateString: getDateString(d),
        startHour: extractStartHour(due, 10.0),
      }
    }

    // Czech: "22. zari", "22 zari", "zari 22"
    const czechAliases = CZECH_MONTHS[monthNum] || []
    for (const alias of czechAliases) {
      if (
        dueNorm.includes(`${dayNum}. ${alias}`) ||
        dueNorm.includes(`${dayNum}.${alias}`) ||
        dueNorm.includes(`${dayNum} ${alias}`) ||
        dueNorm.includes(`${alias} ${dayNum}`)
      ) {
        return {
          dayIndex: i,
          dateString: getDateString(d),
          startHour: extractStartHour(due, 10.0),
        }
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
export function extractStartHour(due: string, defaultHour: number = 10.0): number {
  const dueNorm = stripDiacritics(due.toLowerCase())

  if (dueNorm.includes('14:30') || dueNorm.includes('14.30') || dueNorm.includes('2:30')) return 14.5
  if (dueNorm.includes('10:00') || dueNorm.includes('10.00') || dueNorm.includes('10 am')) return 10.0
  if (dueNorm.includes('09:00') || dueNorm.includes('9 am') || dueNorm.includes('9:00') || dueNorm.includes('9.00')) return 9.0
  if (dueNorm.includes('11:00') || dueNorm.includes('11.00') || dueNorm.includes('11 am')) return 11.0
  if (dueNorm.includes('13:00') || dueNorm.includes('13.00') || dueNorm.includes('1 pm') || dueNorm.includes('1:00')) return 13.0
  if (dueNorm.includes('15:00') || dueNorm.includes('15.00') || dueNorm.includes('3 pm')) return 15.0

  // 1. Time formatted as HH:MM
  const timeMatch = dueNorm.match(/\b(\d{1,2}):(\d{2})\b/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10)
    const m = parseInt(timeMatch[2], 10)
    if (h >= 7 && h <= 21) {
      return h + Math.round(m / 15) * 0.25
    }
  }

  // 2. Czech time with dot: HH.MM (e.g. 14.30, not followed by another dot like 22.09.)
  const timeDotMatch = dueNorm.match(/\b([01]?\d|2[0-3])\.(\d{2})(?!\.)\b/)
  if (timeDotMatch) {
    const h = parseInt(timeDotMatch[1], 10)
    const m = parseInt(timeDotMatch[2], 10)
    if (h >= 7 && h <= 21) {
      return h + Math.round(m / 15) * 0.25
    }
  }

  // 3. Czech preposition or hour suffix (e.g. "v 10", "ve 14", "10h", "14 hod", "14 hodin")
  const prepMatch = dueNorm.match(/\b(?:v|ve)\s*(\d{1,2})\b/)
  if (prepMatch) {
    const h = parseInt(prepMatch[1], 10)
    if (h >= 7 && h <= 21) {
      return h
    }
  }

  const suffixMatch = dueNorm.match(/\b(\d{1,2})\s*(?:h|hod|hodin)\b/)
  if (suffixMatch) {
    const h = parseInt(suffixMatch[1], 10)
    if (h >= 7 && h <= 21) {
      return h
    }
  }

  return defaultHour
}

/**
 * Classifies a target date or date string relative to today into:
 * 'Today', 'Tomorrow', 'This week', 'Next week', or 'Later'
 */
export function getRelativeDayLabel(targetDate: Date | string, referenceDate: Date = new Date()): string {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
  if (isNaN(target.getTime())) return 'This week'

  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)

  const tgt = new Date(target)
  tgt.setHours(0, 0, 0, 0)

  const diffDays = Math.round((tgt.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 0) return 'Overdue'

  // Determine current calendar week (Monday to Sunday)
  const dayOfWeek = (ref.getDay() + 6) % 7 // Monday = 0, Sunday = 6
  const daysRemainingInThisWeek = 6 - dayOfWeek

  if (diffDays <= daysRemainingInThisWeek) {
    return 'This week'
  }
  if (diffDays <= daysRemainingInThisWeek + 7) {
    return 'Next week'
  }
  return 'Later'
}

