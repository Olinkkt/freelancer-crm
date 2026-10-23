import { diffDays, addDays, isIsoDate } from './dates'
import { isOverdue } from './money'
import { isDueToday } from '@/lib/date-utils'
import type {
  ProjectCard,
  Task,
  Invoice,
  Milestone,
  TodayData,
  TodayItem,
  Project,
} from './types'
import type { FollowUpItem, Deal } from '@/lib/crm-types'

export interface BuildTodayInput {
  cards: ProjectCard[]
  tasks: Task[]
  invoices: Invoice[]
  milestones?: Milestone[]
  followUps?: FollowUpItem[]
  wonDealsWithoutProject?: Array<Pick<Deal, 'id' | 'title' | 'company' | 'rawAmount'>>
}

export function buildToday(input: BuildTodayInput, today: string): TodayData {
  const { cards, tasks, invoices, milestones = [], followUps = [], wonDealsWithoutProject = [] } = input

  // Non-archived projects lookup
  const nonArchivedCards = cards.filter((c) => !c.project.archivedAt)
  const projectMap = new Map<string, Project>()
  const cardMap = new Map<string, ProjectCard>()

  for (const c of nonArchivedCards) {
    projectMap.set(c.project.id, c.project)
    cardMap.set(c.project.id, c)
  }

  const milestoneMap = new Map<string, string>()
  for (const m of milestones) {
    milestoneMap.set(m.id, m.title)
  }

  // Set to track items already added so each appears at most once
  const seenTaskIds = new Set<string>()
  const seenProjectIds = new Set<string>()
  const seenInvoiceIds = new Set<string>()

  // 1. Overdue: Open tasks with due_date < today
  const overdueTasks: TodayItem[] = []
  const openTasksForNonArchived = tasks.filter(
    (t) => !t.completedAt && projectMap.has(t.projectId)
  )

  const rawOverdue = openTasksForNonArchived.filter(
    (t) => t.dueDate && t.dueDate < today
  )
  rawOverdue.sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    }
    return a.position - b.position
  })

  for (const t of rawOverdue) {
    seenTaskIds.add(t.id)
    const p = projectMap.get(t.projectId)!
    overdueTasks.push({
      type: 'task',
      task: t,
      project: { id: p.id, title: p.title, company: p.company },
      milestoneTitle: t.milestoneId ? milestoneMap.get(t.milestoneId) ?? null : null,
      fromDate: null,
    })
  }

  // 2. Due today: Open tasks with due_date = today
  const dueTodayTasks: TodayItem[] = []
  const rawDueToday = openTasksForNonArchived.filter(
    (t) => !seenTaskIds.has(t.id) && t.dueDate === today
  )
  rawDueToday.sort((a, b) => a.position - b.position)

  for (const t of rawDueToday) {
    seenTaskIds.add(t.id)
    const p = projectMap.get(t.projectId)!
    dueTodayTasks.push({
      type: 'task',
      task: t,
      project: { id: p.id, title: p.title, company: p.company },
      milestoneTitle: t.milestoneId ? milestoneMap.get(t.milestoneId) ?? null : null,
      fromDate: null,
    })
  }

  // 3. Focus: Open tasks with focus_date <= today
  const focusTasks: TodayItem[] = []
  const rawFocus = openTasksForNonArchived.filter(
    (t) => !seenTaskIds.has(t.id) && t.focusDate && t.focusDate <= today
  )
  rawFocus.sort((a, b) => {
    if (a.focusDate !== b.focusDate) {
      return (a.focusDate || '').localeCompare(b.focusDate || '')
    }
    return a.position - b.position
  })

  for (const t of rawFocus) {
    seenTaskIds.add(t.id)
    const p = projectMap.get(t.projectId)!
    focusTasks.push({
      type: 'task',
      task: t,
      project: { id: p.id, title: p.title, company: p.company },
      milestoneTitle: t.milestoneId ? milestoneMap.get(t.milestoneId) ?? null : null,
      fromDate: t.focusDate && t.focusDate < today ? t.focusDate : null,
    })
  }

  // 4. Needs a next step: active-category, non-archived projects with no open task that has a due_date or focus_date
  const nextStepProjects: TodayItem[] = []
  const rawNextStep = nonArchivedCards.filter((c) => {
    if (c.stage.category !== 'active') return false
    return c.needsNextStep
  })
  rawNextStep.sort((a, b) =>
    a.project.stageChangedAt.localeCompare(b.project.stageChangedAt)
  )

  for (const c of rawNextStep) {
    seenProjectIds.add(c.project.id)
    nextStepProjects.push({
      type: 'project',
      card: c,
    })
  }

  // 5. Waiting on client: Non-archived projects with waiting_since_date set (oldest first)
  const waitingProjects: TodayItem[] = []
  const rawWaiting = nonArchivedCards.filter(
    (c) => !seenProjectIds.has(c.project.id) && !!c.project.waitingSinceDate
  )
  rawWaiting.sort((a, b) =>
    (a.project.waitingSinceDate || '').localeCompare(b.project.waitingSinceDate || '')
  )

  for (const c of rawWaiting) {
    seenProjectIds.add(c.project.id)
    waitingProjects.push({
      type: 'project',
      card: c,
    })
  }

  // 6. Money: Invoices that are sent with due_date <= addDays(today, 3), plus all draft invoices of non-archived projects
  const moneyItems: TodayItem[] = []
  const maxSentDueDate = addDays(today, 3)

  const relevantInvoices = invoices.filter((inv) => {
    if (!projectMap.has(inv.projectId)) return false
    if (inv.status === 'draft') return true
    if (inv.status === 'sent') {
      return !inv.dueDate || inv.dueDate <= maxSentDueDate
    }
    return false
  })

  relevantInvoices.sort((a, b) => {
    const aOverdue = isOverdue(a, today)
    const bOverdue = isOverdue(b, today)
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    const aDate = a.dueDate || '9999-99-99'
    const bDate = b.dueDate || '9999-99-99'
    return aDate.localeCompare(bDate)
  })

  for (const inv of relevantInvoices) {
    seenInvoiceIds.add(inv.id)
    const p = projectMap.get(inv.projectId)!
    const overdue = isOverdue(inv, today)
    const overdueDays = overdue && inv.dueDate ? diffDays(inv.dueDate, today) : null
    moneyItems.push({
      type: 'invoice',
      invoice: inv,
      project: { id: p.id, title: p.title, company: p.company },
      overdueDays,
    })
  }

  // 7. Sales: Follow-ups not completed where isDueToday(day), plus Won deals without a project ("Start project")
  const salesItems: TodayItem[] = []
  const dueFollowUps = followUps.filter(
    (fu) => !fu.completed && (fu.day === 'Today' || isDueToday(fu.day))
  )
  dueFollowUps.sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  for (const fu of dueFollowUps) {
    salesItems.push({
      type: 'followUp',
      followUp: fu,
    })
  }

  for (const deal of wonDealsWithoutProject) {
    salesItems.push({
      type: 'startProject',
      deal,
    })
  }

  const sections: TodayData['sections'] = [
    { id: 'overdue', items: overdueTasks },
    { id: 'dueToday', items: dueTodayTasks },
    { id: 'focus', items: focusTasks },
    { id: 'nextStep', items: nextStepProjects },
    { id: 'waiting', items: waitingProjects },
    { id: 'money', items: moneyItems },
    { id: 'sales', items: salesItems },
  ]

  const badgeCount = overdueTasks.length + dueTodayTasks.length

  return {
    today,
    sections,
    badgeCount,
  }
}
