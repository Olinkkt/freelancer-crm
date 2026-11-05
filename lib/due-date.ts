import { getDateString, stripDiacritics } from '@/lib/date-utils'

/**
 * Next-action due dates are stored as plain `YYYY-MM-DD` strings (local date, no time).
 * Older rows held free text ("Tomorrow, 10:00"); `normalizeDueDate` converts those.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value?: string | null): value is string {
  return !!value && ISO_DATE.test(value)
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function addDays(base: Date, days: number): Date {
  const out = startOfDay(base)
  out.setDate(out.getDate() + days)
  return out
}

/** Next occurrence of a weekday (0 = Sunday … 6 = Saturday), always after `base`. */
function nextWeekday(base: Date, weekday: number): Date {
  const out = startOfDay(base)
  const delta = ((weekday - out.getDay() + 7) % 7) || 7
  out.setDate(out.getDate() + delta)
  return out
}

export function dueDatePresets(now: Date = new Date()): { label: string; value: string }[] {
  return [
    { label: 'Today', value: getDateString(now) },
    { label: 'Tomorrow', value: getDateString(addDays(now, 1)) },
    { label: 'In 3 days', value: getDateString(addDays(now, 3)) },
    { label: 'Next week', value: getDateString(nextWeekday(now, 1)) },
  ]
}

const WEEKDAYS: { regex: RegExp; idx: number }[] = [
  { regex: /\b(sun|sunday|nedele|ne)\b/, idx: 0 },
  { regex: /\b(mon|monday|pondeli|po)\b/, idx: 1 },
  { regex: /\b(tue|tuesday|utery|ut)\b/, idx: 2 },
  { regex: /\b(wed|wednesday|streda|st)\b/, idx: 3 },
  { regex: /\b(thu|thursday|ctvrtek|ct)\b/, idx: 4 },
  { regex: /\b(fri|friday|patek|pa)\b/, idx: 5 },
  { regex: /\b(sat|saturday|sobota|so)\b/, idx: 6 },
]

/**
 * Converts any due-date input (ISO date, ISO timestamp, or legacy free text) to `YYYY-MM-DD`.
 * Returns null when the text can't be understood.
 */
export function normalizeDueDate(input?: string | null, now: Date = new Date()): string | null {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/)
  if (iso) return iso[1]

  const s = stripDiacritics(raw.toLowerCase())
  if (s === 'done') return null

  if (/\b(today|dnes|dneska)\b/.test(s)) return getDateString(now)
  if (/\b(tomorrow|zitra|zitrek)\b/.test(s)) return getDateString(addDays(now, 1))
  if (/\b(pozitri|pozitrek)\b/.test(s)) return getDateString(addDays(now, 2))

  const inDays = s.match(/\b(?:in|za)\s+(\d{1,3})\s+(?:day|days|den|dny|dni)\b/)
  if (inDays) return getDateString(addDays(now, parseInt(inDays[1], 10)))

  if (/\bnext week\b|\bpristi tyden\b/.test(s)) return getDateString(nextWeekday(now, 1))

  for (const { regex, idx } of WEEKDAYS) {
    if (regex.test(s)) return getDateString(nextWeekday(now, idx))
  }

  // Czech numeric "22.9." / "22. 9. 2026"
  const cz = s.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/)
  if (cz) {
    const year = cz[3] ? parseInt(cz[3], 10) : now.getFullYear()
    const d = new Date(year, parseInt(cz[2], 10) - 1, parseInt(cz[1], 10))
    if (!isNaN(d.getTime())) return getDateString(d)
  }

  // "Sep 22", "22 Sep"
  const withYear = new Date(`${raw} ${now.getFullYear()}`)
  if (!isNaN(withYear.getTime()) && /[a-z]/i.test(raw) && /\d/.test(raw)) return getDateString(withYear)

  if (/\bthis week\b|\btento tyden\b/.test(s)) {
    const friday = startOfDay(now)
    const delta = (5 - friday.getDay() + 7) % 7
    friday.setDate(friday.getDate() + delta)
    return getDateString(friday)
  }

  return null
}

/** Whole days from today to the due date (negative = overdue). null if not an ISO date. */
export function daysUntil(due?: string | null, now: Date = new Date()): number | null {
  if (!isIsoDate(due)) return null
  return Math.round((parseIso(due).getTime() - startOfDay(now).getTime()) / 86400000)
}

export function isOverdue(due?: string | null, now: Date = new Date()): boolean {
  const d = daysUntil(due, now)
  return d !== null && d < 0
}

/** "Today", "Tomorrow", "Mon, Nov 9", "3 days overdue". Legacy text is returned unchanged. */
export function formatDue(due?: string | null, now: Date = new Date()): string {
  if (!due) return ''
  const diff = daysUntil(due, now)
  if (diff === null) return due
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${-diff} days overdue`
  const d = parseIso(due)
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Suggested next actions per pipeline stage. */
const NEXT_ACTION_PRESETS: Record<string, string[]> = {
  Lead: ['Discovery call', 'Send intro email', 'Share portfolio', 'Qualify budget'],
  Qualified: ['Send proposal', 'Scope review call', 'Share case studies', 'Confirm timeline'],
  Proposal: ['Follow up on proposal', 'Send revised scope', 'Answer questions', 'Send contract'],
  Closed: ['Kickoff meeting', 'Send deposit invoice', 'Share project plan'],
  Deposit: ['Send deposit invoice', 'Check deposit arrived', 'Chase deposit'],
  Materials: ['Chase client materials', 'Send materials checklist', 'Review received materials'],
  Build: ['Share preview', 'Collect preview feedback', 'Finish build'],
  Handoff: ['Hand over project', 'Send final invoice', 'Check final payment'],
  Revisions: ['Apply revisions', 'Confirm revisions done'],
  Completed: ['Ask for a testimonial', 'Offer a maintenance retainer'],
}

export function nextActionPresets(stage: string): string[] {
  return NEXT_ACTION_PRESETS[stage] ?? NEXT_ACTION_PRESETS.Lead
}

const ALL_PRESETS = new Set(Object.values(NEXT_ACTION_PRESETS).flat())

/** True when the text is empty or just an untouched preset, so a stage change may swap it. */
export function isUntouchedPreset(action: string): boolean {
  const t = action.trim()
  return !t || ALL_PRESETS.has(t)
}
