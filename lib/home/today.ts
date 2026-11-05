import { Deal, FollowUpItem, isPmStage } from '@/lib/crm-types'
import { daysUntil, normalizeDueDate } from '@/lib/due-date'

export type TodayItem =
  | { kind: 'deal'; key: string; deal: Deal; title: string; detail: string; tone: 'overdue' | 'today' | 'muted' }
  | { kind: 'followUp'; key: string; followUp: FollowUpItem; title: string; detail: string; tone: 'overdue' | 'today' | 'muted' }

export interface TodayGroups {
  due: TodayItem[]
  waiting: TodayItem[]
  needsYou: TodayItem[]
}

const openMaterials = (d: Deal) =>
  (d.deliverables ?? []).filter((i) => i.section === 'podklady' && i.status !== 'Done')

/**
 * Today = what to act on now.
 * - Due: next actions / follow-ups due today or overdue.
 * - Waiting on client: signed deals with client materials still missing.
 * - Needs you: deals missing a next action or due date (GTD rule), undated follow-ups.
 * A deal shows up once, in the first group that fits.
 */
export function buildToday(deals: Deal[], followUps: FollowUpItem[], completedFollowUps: string[], now = new Date()): TodayGroups {
  const due: TodayItem[] = []
  const waiting: TodayItem[] = []
  const needsYou: TodayItem[] = []
  const dueRank = new Map<string, number>()

  for (const deal of deals) {
    if (deal.waiting) {
      waiting.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail: 'Waiting on client',
        tone: 'muted',
      })
      continue
    }
    const diff = daysUntil(deal.nextDueDate, now)
    if (deal.next && diff !== null && diff <= 0) {
      due.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.next,
        detail: `${deal.title} · ${deal.stage}`,
        tone: diff < 0 ? 'overdue' : 'today',
      })
      dueRank.set(deal.id, diff)
      continue
    }
    const missing = openMaterials(deal)
    if (isPmStage(deal.stage) && (deal.stage === 'Materials' || missing.length > 0)) {
      waiting.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail:
          missing.length > 0
            ? `${missing.length} material${missing.length === 1 ? '' : 's'} missing: ${missing
                .slice(0, 2)
                .map((i) => i.title)
                .join(', ')}${missing.length > 2 ? '…' : ''}`
            : 'Waiting on client materials',
        tone: 'muted',
      })
      continue
    }
    if (!deal.next || !deal.nextDueDate) {
      needsYou.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail: !deal.next ? `${deal.stage} · no next action` : `${deal.stage} · “${deal.next}” has no due date`,
        tone: 'muted',
      })
    }
  }

  for (const f of followUps) {
    if (completedFollowUps.includes(f.id)) continue
    const iso = normalizeDueDate(f.time, now) ?? (f.day?.toLowerCase() === 'today' ? normalizeDueDate('today', now) : null)
    const diff = daysUntil(iso, now)
    const base = { kind: 'followUp' as const, key: f.id, followUp: f, title: f.action, detail: f.company }
    if (diff === null) {
      needsYou.push({ ...base, detail: `${f.company} · no date`, tone: 'muted' })
    } else if (diff <= 0) {
      due.push({ ...base, tone: diff < 0 ? 'overdue' : 'today' })
      dueRank.set(f.id, diff)
    }
  }

  due.sort((a, b) => (dueRank.get(a.key) ?? 0) - (dueRank.get(b.key) ?? 0))
  return { due, waiting, needsYou }
}

/** Next actions dated after today, soonest first. Fills the quiet days. */
export function buildUpcoming(deals: Deal[], now = new Date()): Deal[] {
  return deals
    .filter((d) => {
      if (d.waiting || !d.next || !d.nextDueDate) return false
      const diff = daysUntil(d.nextDueDate, now)
      return diff !== null && diff > 0
    })
    .sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))
}
