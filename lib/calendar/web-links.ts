import { extractStartHour } from '@/lib/date-utils'

/** Event date/time in the shape calendar apps expect */
export interface GoogleCalendarEventDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

/**
 * Resolves CRM date strings into event start and end for the .ics feed.
 */
export function resolveEventDates(dateStr?: string | null): {
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
} {
  const defaultDurationMs = 60 * 60 * 1000 // 1 hour

  if (!dateStr || !dateStr.trim()) {
    const now = new Date()
    return {
      start: { dateTime: now.toISOString() },
      end: { dateTime: new Date(now.getTime() + defaultDurationMs).toISOString() },
    }
  }

  const clean = dateStr.trim()

  // 1. Exact all-day ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number)
    const startDate = new Date(Date.UTC(y, m - 1, d))
    const endDate = new Date(startDate.getTime() + 86400000)
    const endStr = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
    return {
      start: { date: clean },
      end: { date: endStr },
    }
  }

  // 2. Full ISO timestamp (e.g. 2026-10-21T14:00:00Z)
  const parsedDate = new Date(clean)
  if (!isNaN(parsedDate.getTime()) && (clean.includes('T') || clean.includes(':'))) {
    return {
      start: { dateTime: parsedDate.toISOString() },
      end: { dateTime: new Date(parsedDate.getTime() + defaultDurationMs).toISOString() },
    }
  }

  // 3. Natural date string handling (e.g. "Tomorrow, 10:00 AM", "Today, 14:00")
  const now = new Date()
  const targetDay = new Date(now)

  const lower = clean.toLowerCase()
  if (lower.includes('tomorrow') || lower.includes('zitra')) {
    targetDay.setDate(targetDay.getDate() + 1)
  }

  const hour = extractStartHour(clean, 10.0)
  const wholeHour = Math.floor(hour)
  const minutes = Math.round((hour - wholeHour) * 60)

  targetDay.setHours(wholeHour, minutes, 0, 0)

  return {
    start: { dateTime: targetDay.toISOString() },
    end: { dateTime: new Date(targetDay.getTime() + defaultDurationMs).toISOString() },
  }
}
