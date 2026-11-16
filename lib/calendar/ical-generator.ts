import { Deal } from '@/lib/crm-types'
import { resolveEventDates } from '@/lib/calendar/web-links'

/**
 * Escapes characters with special meaning in iCalendar format per RFC 5545 Section 3.3.11.
 */
export function escapeIcsText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
}

/**
 * Folds iCalendar content lines to 75 octets per RFC 5545 Section 3.1.
 */
export function foldIcsLine(line: string, maxLen = 75): string {
  if (Buffer.byteLength(line, 'utf8') <= maxLen) return line
  // The limit is in octets, not characters, and a multi-byte character
  // (č, ř, emoji) must never be split across two lines
  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8')
    if (currentBytes + bytes > maxLen) {
      chunks.push(current)
      // Continuation lines start with a space, which counts toward the limit
      current = ' '
      currentBytes = 1
    }
    current += char
    currentBytes += bytes
  }
  chunks.push(current)
  return chunks.join('\r\n')
}

/**
 * Formats a Date or ISO string into an iCalendar UTC timestamp: YYYYMMDDTHHmmssZ.
 */
export function formatIcsUtcDateTime(d: Date | string | number): string {
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
  if (isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Formats a date string (YYYY-MM-DD) into iCalendar DATE format: YYYYMMDD.
 */
export function formatIcsDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '').slice(0, 8)
}

export interface IcsCalendarOptions {
  calendarName?: string
  calendarDescription?: string
  deals?: Deal[]
  now?: Date
}

/**
 * Generates an RFC 5545 compliant .ics string for deal milestones.
 */
export function generateIcsCalendar(options: IcsCalendarOptions = {}): string {
  const {
    calendarName = 'Freelancer CRM',
    calendarDescription = 'Deal next actions from Freelancer CRM',
    deals = [],
    now = new Date(),
  } = options

  const dtstamp = formatIcsUtcDateTime(now)
  const lines: string[] = []

  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Freelancer CRM//Calendar Feed//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName)}`)
  lines.push(`X-WR-CALDESC:${escapeIcsText(calendarDescription)}`)
  lines.push('X-WR-TIMEZONE:UTC')

  // 1. Process Deals with upcoming milestones
  for (const deal of deals) {
    // A deal waiting on the client has no next action to show, even if an old one is still stored
    if (deal.waiting || !deal.next || !deal.nextDueDate || deal.nextDueDate === 'Done') {
      continue
    }

    const { start, end } = resolveEventDates(deal.nextDueDate)
    const uid = `deal-milestone-${deal.id}@freelancercrm.local`
    const summary = `Milestone: ${deal.next} (${deal.contactName})`
    const descriptionLines: string[] = [
      `Deal: ${deal.title}`,
      `Value: ${deal.value}`,
      `Stage: ${deal.stage}`,
      deal.contactName ? `Client: ${deal.contactName}` : '',
      deal.notes ? `\nNotes:\n${deal.notes}` : '',
    ].filter(Boolean)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${dtstamp}`)

    if (start.date && end.date) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDateOnly(start.date)}`)
      lines.push(`DTEND;VALUE=DATE:${formatIcsDateOnly(end.date)}`)
    } else {
      lines.push(`DTSTART:${formatIcsUtcDateTime(start.dateTime || now)}`)
      lines.push(`DTEND:${formatIcsUtcDateTime(end.dateTime || now)}`)
    }

    lines.push(`SUMMARY:${escapeIcsText(summary)}`)
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`)
    lines.push('STATUS:CONFIRMED')
    lines.push('CATEGORIES:Milestone,Freelancer CRM')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.map((line) => foldIcsLine(line)).join('\r\n') + '\r\n'
}
