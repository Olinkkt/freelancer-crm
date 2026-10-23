import { Activity, Deal } from '@/lib/crm-types'
import { resolveEventDates } from '@/lib/google-calendar/web-links'
import { dealNeedsNextAction } from '@/lib/deals/next-action'

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
  if (line.length <= maxLen) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, maxLen))
  let idx = maxLen
  while (idx < line.length) {
    chunks.push(' ' + line.slice(idx, idx + maxLen - 1))
    idx += maxLen - 1
  }
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
  activities?: Activity[]
  deals?: Deal[]
  now?: Date
}

/**
 * Generates an RFC 5545 compliant .ics string for CRM activities and deal milestones.
 */
export function generateIcsCalendar(options: IcsCalendarOptions = {}): string {
  const {
    calendarName = 'Freelancer CRM',
    calendarDescription = 'Milestones, calls, and client meetings from Freelancer CRM',
    activities = [],
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
    if (!dealNeedsNextAction(deal) || !deal.next || !deal.nextDueDate || deal.nextDueDate === 'Done') {
      continue
    }

    const { start, end } = resolveEventDates(deal.nextDueDate)
    const uid = `deal-milestone-${deal.id}@freelancercrm.local`
    const summary = `Milestone: ${deal.next} (${deal.company})`
    const descriptionLines: string[] = [
      `Deal: ${deal.title}`,
      `Company: ${deal.company}`,
      `Value: ${deal.value}`,
      `Stage: ${deal.stage}`,
      deal.contactName ? `Contact: ${deal.contactName}` : '',
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

  // 2. Process Activities (Calls, Meetings, Follow-ups)
  for (const act of activities) {
    if (!act.date || act.status === 'Completed') {
      continue
    }

    const { start, end } = resolveEventDates(act.date)
    const uid = `activity-${act.id}@freelancercrm.local`
    const summary = `${act.type}: ${act.person || act.company}${act.title ? ` - ${act.title}` : ''}`
    const descriptionLines: string[] = [
      `Type: ${act.type}`,
      `Person: ${act.person}`,
      `Company: ${act.company}`,
      `Status: ${act.status}`,
      act.summary ? `\nSummary:\n${act.summary}` : '',
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
    lines.push(`CATEGORIES:${escapeIcsText(act.type)},Freelancer CRM`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.map((line) => foldIcsLine(line)).join('\r\n') + '\r\n'
}
