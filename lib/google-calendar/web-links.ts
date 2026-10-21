import { GoogleCalendarWebLinkParams } from './types'

function pad(num: number): string {
  return String(num).padStart(2, '0')
}

/**
 * Formats a Date object to Google Calendar's compact UTC string: YYYYMMDDTHHmmssZ
 */
export function formatToUtcCompact(date: Date): string {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const h = pad(date.getUTCHours())
  const min = pad(date.getUTCMinutes())
  const s = pad(date.getUTCSeconds())
  return `${y}${m}${d}T${h}${min}${s}Z`
}

/**
 * Formats a Date object to Google Calendar's compact all-day date string: YYYYMMDD
 */
export function formatToDateCompact(date: Date): string {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  return `${y}${m}${d}`
}

/**
 * Checks if a string is already in Google compact format (timed: YYYYMMDDTHHmmssZ or all-day: YYYYMMDD)
 */
function isCompactTimed(str: string): boolean {
  return /^\d{8}T\d{6}Z?$/i.test(str.trim())
}

function isCompactDate(str: string): boolean {
  return /^\d{8}$/.test(str.trim())
}

/**
 * Parses a YYYY-MM-DD or YYYYMMDD string as a UTC date at 00:00:00
 */
function parseDateStringUtc(str: string): Date | null {
  const clean = str.trim()
  const match = clean.match(/^(\d{4})-?(\d{2})-?(\d{2})$/)
  if (!match) return null
  const y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10) - 1
  const d = parseInt(match[3], 10)
  return new Date(Date.UTC(y, m, d))
}

/**
 * Formats the `dates` query parameter (e.g. 20261021T100000Z/20261021T110000Z or 20261021/20261022)
 */
function formatDatesParam(params: {
  startTime?: string
  endTime?: string
  date?: string
  addHourDuration?: number
}): string | null {
  const durationHours = typeof params.addHourDuration === 'number' && !isNaN(params.addHourDuration)
    ? params.addHourDuration
    : 1

  // 1. Both startTime and endTime are already compact timed strings
  if (params.startTime && isCompactTimed(params.startTime)) {
    const startCompact = params.startTime.trim().toUpperCase().endsWith('Z')
      ? params.startTime.trim().toUpperCase()
      : `${params.startTime.trim().toUpperCase()}Z`

    let endCompact: string
    if (params.endTime && isCompactTimed(params.endTime)) {
      endCompact = params.endTime.trim().toUpperCase().endsWith('Z')
        ? params.endTime.trim().toUpperCase()
        : `${params.endTime.trim().toUpperCase()}Z`
    } else {
      // Parse compact start and add duration
      const y = parseInt(startCompact.slice(0, 4), 10)
      const m = parseInt(startCompact.slice(4, 6), 10) - 1
      const d = parseInt(startCompact.slice(6, 8), 10)
      const h = parseInt(startCompact.slice(9, 11), 10)
      const min = parseInt(startCompact.slice(11, 13), 10)
      const s = parseInt(startCompact.slice(13, 15), 10)
      const startDate = new Date(Date.UTC(y, m, d, h, min, s))
      const endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000)
      endCompact = formatToUtcCompact(endDate)
    }
    return `${startCompact}/${endCompact}`
  }

  // 2. Timed event with ISO / parseable startTime
  if (params.startTime) {
    let rawStart = params.startTime.trim()

    // Handle time-only startTime when date is also provided (e.g. date: '2026-10-21', startTime: '14:30')
    if (params.date && /^\d{1,2}:\d{2}(:\d{2})?$/.test(rawStart)) {
      const timeParts = rawStart.split(':')
      const h = pad(parseInt(timeParts[0], 10))
      const min = pad(parseInt(timeParts[1], 10))
      const s = pad(timeParts[2] ? parseInt(timeParts[2], 10) : 0)
      rawStart = `${params.date.trim()}T${h}:${min}:${s}Z`
    }

    const startDate = new Date(rawStart)
    if (!isNaN(startDate.getTime())) {
      let endDate: Date
      if (params.endTime) {
        let rawEnd = params.endTime.trim()
        if (params.date && /^\d{1,2}:\d{2}(:\d{2})?$/.test(rawEnd)) {
          const timeParts = rawEnd.split(':')
          const h = pad(parseInt(timeParts[0], 10))
          const min = pad(parseInt(timeParts[1], 10))
          const s = pad(timeParts[2] ? parseInt(timeParts[2], 10) : 0)
          rawEnd = `${params.date.trim()}T${h}:${min}:${s}Z`
        }
        const parsedEnd = new Date(rawEnd)
        endDate = !isNaN(parsedEnd.getTime())
          ? parsedEnd
          : new Date(startDate.getTime() + durationHours * 3600 * 1000)
      } else {
        endDate = new Date(startDate.getTime() + durationHours * 3600 * 1000)
      }

      return `${formatToUtcCompact(startDate)}/${formatToUtcCompact(endDate)}`
    }
  }

  // 3. All-day event via date parameter (or date-only)
  if (params.date) {
    const parsedStart = parseDateStringUtc(params.date)
    if (parsedStart) {
      const startCompact = formatToDateCompact(parsedStart)
      let endCompact: string

      if (params.endTime) {
        if (isCompactDate(params.endTime)) {
          endCompact = params.endTime.trim()
        } else {
          const parsedEnd = parseDateStringUtc(params.endTime)
          endCompact = parsedEnd ? formatToDateCompact(parsedEnd) : formatToDateCompact(new Date(parsedStart.getTime() + 86400000))
        }
      } else {
        // All-day end date is exclusive in Google Calendar, so single day = next day
        const nextDay = new Date(parsedStart.getTime() + 86400000)
        endCompact = formatToDateCompact(nextDay)
      }

      return `${startCompact}/${endCompact}`
    } else if (isCompactDate(params.date)) {
      const startCompact = params.date.trim()
      let endCompact = startCompact
      if (params.endTime && isCompactDate(params.endTime)) {
        endCompact = params.endTime.trim()
      } else {
        const y = parseInt(startCompact.slice(0, 4), 10)
        const m = parseInt(startCompact.slice(4, 6), 10) - 1
        const d = parseInt(startCompact.slice(6, 8), 10)
        const nextDay = new Date(Date.UTC(y, m, d + 1))
        endCompact = formatToDateCompact(nextDay)
      }
      return `${startCompact}/${endCompact}`
    }
  }

  return null
}

/**
 * Generates a pre-filled Google Calendar event creation URL (Web Link).
 * Formats a `https://calendar.google.com/calendar/render?action=TEMPLATE...` URL
 * with encoded parameters and compact dates (e.g. 20261021T100000Z or 20261021 for all-day).
 */
export function generateGoogleCalendarWebLink(params: GoogleCalendarWebLinkParams): string {
  const queryParts: string[] = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(params.title || '')}`,
  ]

  const dates = formatDatesParam(params)
  if (dates) {
    // Preserve the literal slash separating start and end dates
    queryParts.push(`dates=${dates}`)
  }

  if (params.details) {
    queryParts.push(`details=${encodeURIComponent(params.details)}`)
  }

  if (params.location) {
    queryParts.push(`location=${encodeURIComponent(params.location)}`)
  }

  return `https://calendar.google.com/calendar/render?${queryParts.join('&')}`
}
