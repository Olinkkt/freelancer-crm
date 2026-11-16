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
 * Strips diacritics / accents from text (e.g. "pondělí" -> "pondeli")
 */
export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

