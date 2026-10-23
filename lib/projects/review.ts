import { diffDays, addDays, isIsoDate } from './dates'
import { isOverdue } from './money'
import type {
  ProjectCard,
  Task,
  Invoice,
  Milestone,
  TodayItem,
  Project,
} from './types'

export function isReviewDue(lastReviewAt: string | null | undefined, now: string | Date = new Date().toISOString()): boolean {
  if (!lastReviewAt) return true
  const nowDate = typeof now === 'string' ? new Date(now).getTime() : now.getTime()
  const lastDate = new Date(lastReviewAt).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  return nowDate - lastDate >= sevenDaysMs
}

export interface BuildWeeklyReviewInput {
  cards: ProjectCard[]
  tasks: Task[]
  invoices: Invoice[]
  milestones?: Milestone[]
  lastReviewAt?: string | null
}

export interface WeeklyReviewData {
  looseEnds: TodayItem[]
  projects: ProjectCard[]
  money: TodayItem[]
  nextWeek: Array<{ date: string; items: TodayItem[] }>
  lastReviewAt: string | null
}

export function buildWeeklyReview(
  input: BuildWeeklyReviewInput,
  today: string
): WeeklyReviewData {
  const { cards, tasks, invoices, milestones = [], lastReviewAt = null } = input

  // Non-archived projects lookup
  const nonArchivedCards = cards.filter((c) => !c.project.archivedAt)
  const projectMap = new Map<string, Project>()
  for (const c of nonArchivedCards) {
    projectMap.set(c.project.id, c.project)
  }

  const milestoneMap = new Map<string, string>()
  for (const m of milestones) {
    milestoneMap.set(m.id, m.title)
  }

  // 1. Loose ends: open tasks with no due_date, no focus_date and no milestone_id
  const looseEndTasks = tasks.filter(
    (t) =>
      !t.completedAt &&
      !t.dueDate &&
      !t.focusDate &&
      !t.milestoneId &&
      projectMap.has(t.projectId)
  )
  looseEndTasks.sort((a, b) => a.position - b.position)

  const looseEnds: TodayItem[] = looseEndTasks.map((t) => {
    const p = projectMap.get(t.projectId)!
    return {
      type: 'task',
      task: t,
      project: { id: p.id, title: p.title, company: p.company },
      milestoneTitle: null,
      fromDate: null,
    }
  })

  // 2. Projects: non-archived projects in active or review, ordered by due_date (nulls last)
  const activeOrReviewCards = nonArchivedCards.filter(
    (c) => c.stage.category === 'active' || c.stage.category === 'review'
  )
  activeOrReviewCards.sort((a, b) => {
    const aDue = a.project.dueDate || '9999-99-99'
    const bDue = b.project.dueDate || '9999-99-99'
    if (aDue !== bDue) return aDue.localeCompare(bDue)
    return a.project.title.localeCompare(b.project.title)
  })

  // 3. Money: sent invoices (overdue first) and draft invoices
  const moneyInvoices = invoices.filter((inv) => {
    if (!projectMap.has(inv.projectId)) return false
    return inv.status === 'sent' || inv.status === 'draft'
  })

  moneyInvoices.sort((a, b) => {
    const aOverdue = isOverdue(a, today)
    const bOverdue = isOverdue(b, today)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    const aDue = a.dueDate || '9999-99-99'
    const bDue = b.dueDate || '9999-99-99'
    return aDue.localeCompare(bDue)
  })

  const money: TodayItem[] = moneyInvoices.map((inv) => {
    const p = projectMap.get(inv.projectId)!
    const overdue = isOverdue(inv, today)
    const overdueDays = overdue && inv.dueDate ? diffDays(inv.dueDate, today) : null
    return {
      type: 'invoice',
      invoice: inv,
      project: { id: p.id, title: p.title, company: p.company },
      overdueDays,
    }
  })

  // 4. Next week: open tasks with a due_date or focus_date from next Monday to next Sunday, grouped by day
  const [y, m, d] = today.split('-').map(Number)
  const curDate = new Date(Date.UTC(y, m - 1, d))
  const curDay = curDate.getUTCDay()
  const daysUntilNextMon = ((1 - curDay + 7) % 7) || 7
  const nextMonday = addDays(today, daysUntilNextMon)

  const nextWeekDays: string[] = []
  for (let i = 0; i < 7; i++) {
    nextWeekDays.push(addDays(nextMonday, i))
  }

  const nextWeekDaySet = new Set(nextWeekDays)
  const nextWeekTasks = tasks.filter((t) => {
    if (t.completedAt || !projectMap.has(t.projectId)) return false
    const date = t.dueDate || t.focusDate
    return date ? nextWeekDaySet.has(date) : false
  })

  const nextWeek: Array<{ date: string; items: TodayItem[] }> = nextWeekDays.map((date) => {
    const dayTasks = nextWeekTasks.filter((t) => (t.dueDate || t.focusDate) === date)
    dayTasks.sort((a, b) => a.position - b.position)
    return {
      date,
      items: dayTasks.map((t) => {
        const p = projectMap.get(t.projectId)!
        return {
          type: 'task',
          task: t,
          project: { id: p.id, title: p.title, company: p.company },
          milestoneTitle: t.milestoneId ? milestoneMap.get(t.milestoneId) ?? null : null,
          fromDate: t.focusDate && t.focusDate < today ? t.focusDate : null,
        }
      }),
    }
  })

  return {
    looseEnds,
    projects: activeOrReviewCards,
    money,
    nextWeek,
    lastReviewAt: lastReviewAt ?? null,
  }
}
