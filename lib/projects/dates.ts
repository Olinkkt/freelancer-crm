export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

export function localToday(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + n)
  const ry = date.getUTCFullYear()
  const rm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const rd = String(date.getUTCDate()).padStart(2, '0')
  return `${ry}-${rm}-${rd}`
}

export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  const date1 = Date.UTC(y1, m1 - 1, d1)
  const date2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((date2 - date1) / (1000 * 60 * 60 * 24))
}

export function toIsoDateLenient(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null
  const trimmed = s.trim()
  if (!trimmed) return null

  // 1. Try first 10 characters YYYY-MM-DD
  const first10 = trimmed.slice(0, 10)
  if (isIsoDate(first10)) {
    return first10
  }

  // 2. Try D.M.YYYY or DD.MM.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotMatch) {
    const day = String(Number(dotMatch[1])).padStart(2, '0')
    const month = String(Number(dotMatch[2])).padStart(2, '0')
    const year = dotMatch[3]
    const candidate = `${year}-${month}-${day}`
    if (isIsoDate(candidate)) {
      return candidate
    }
  }

  return null
}

export function parseDateInput(text: string, today: string): string | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) return null

  if (trimmed === 'today' || trimmed === 'tod' || trimmed === 'dnes') {
    return today
  }

  if (
    trimmed === 'tomorrow' ||
    trimmed === 'tom' ||
    trimmed === 'zitra' ||
    trimmed === 'zítra'
  ) {
    return addDays(today, 1)
  }

  // Next week -> next Monday strictly after today
  if (trimmed === 'next week') {
    const [y, m, d] = today.split('-').map(Number)
    const curDate = new Date(Date.UTC(y, m - 1, d))
    const curDay = curDate.getUTCDay() // 0 = Sun, 1 = Mon ...
    // Days until next Monday: if Monday (1), next Monday is 7 days away.
    const daysUntilNextMon = ((1 - curDay + 7) % 7) || 7
    return addDays(today, daysUntilNextMon)
  }

  // Relative +Nd or +Nw
  const relMatch = trimmed.match(/^\+(\d+)\s*(d|w|days?|weeks?)$/)
  if (relMatch) {
    const count = parseInt(relMatch[1], 10)
    const unit = relMatch[2].startsWith('w') ? 7 : 1
    return addDays(today, count * unit)
  }

  // Weekdays: mon, tue, wed, thu, fri, sat, sun (+ full names)
  const weekdays: Record<string, number> = {
    mon: 1, monday: 1, pondeli: 1, pondělí: 1,
    tue: 2, tuesday: 2, utery: 2, úterý: 2,
    wed: 3, wednesday: 3, streda: 3, středa: 3,
    thu: 4, thursday: 4, ctvrtek: 4, čtvrtek: 4,
    fri: 5, friday: 5, patek: 5, pátek: 5,
    sat: 6, saturday: 6, sobota: 6,
    sun: 0, sunday: 0, nedele: 0, neděle: 0,
  }
  if (trimmed in weekdays) {
    const targetDay = weekdays[trimmed]
    const [y, m, d] = today.split('-').map(Number)
    const curDate = new Date(Date.UTC(y, m - 1, d))
    const curDay = curDate.getUTCDay()
    let daysToAdd = (targetDay - curDay + 7) % 7
    if (daysToAdd === 0) daysToAdd = 7 // Strictly after today
    return addDays(today, daysToAdd)
  }

  // D.M. or D.M.YYYY
  const dmMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(?:(\d{4}))?$/)
  if (dmMatch) {
    const dNum = parseInt(dmMatch[1], 10)
    const mNum = parseInt(dmMatch[2], 10)
    const dayStr = String(dNum).padStart(2, '0')
    const monthStr = String(mNum).padStart(2, '0')
    const [curY] = today.split('-').map(Number)

    if (dmMatch[3]) {
      const candidate = `${dmMatch[3]}-${monthStr}-${dayStr}`
      if (isIsoDate(candidate)) return candidate
    } else {
      // Current year, or next year if past
      const candidateCur = `${curY}-${monthStr}-${dayStr}`
      if (isIsoDate(candidateCur)) {
        if (candidateCur < today) {
          const candidateNext = `${curY + 1}-${monthStr}-${dayStr}`
          if (isIsoDate(candidateNext)) return candidateNext
        } else {
          return candidateCur
        }
      }
    }
  }

  // YYYY-MM-DD
  if (isIsoDate(trimmed)) {
    return trimmed
  }

  return null
}

export function formatRelativeDate(iso: string, today: string, locale = 'en-US'): string {
  const diff = diffDays(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'

  const [y, m, d] = iso.split('-').map(Number)
  const targetDate = new Date(Date.UTC(y, m - 1, d))

  if (diff >= -6 && diff <= 6) {
    return targetDate.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })
  }

  return targetDate.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
