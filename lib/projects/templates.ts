import { addDays, diffDays } from './dates'
import { scheduleInvoices } from './money'
import { generateId } from '@/lib/db/ids'
import type {
  Project,
  ProjectTemplate,
  Milestone,
  Task,
  Invoice,
  TemplateMilestone,
  TemplateTask,
} from './types'

export interface ApplyTemplateInput {
  project: {
    id: string
    startDate: string
    dueDate: string | null
    budgetMinor: number | null
    currency: string
    billingType?: string
  }
  template: ProjectTemplate
  now: string
}

export interface AppliedTemplateGraph {
  projectPatch: {
    template_id: string
    billing_type: 'fixed' | 'hourly' | 'retainer'
    revisions_included: number | null
    due_date: string | null
  }
  milestones: any[]
  tasks: any[]
  invoices: any[]
}

export function buildTemplateGraph(input: ApplyTemplateInput): AppliedTemplateGraph {
  const { project, template, now } = input

  // Due date: if empty and template has durationDays -> start + durationDays
  const dueDate =
    project.dueDate ||
    (template.durationDays != null
      ? addDays(project.startDate, template.durationDays)
      : null)

  const projectPatch = {
    template_id: template.id,
    billing_type: (project.billingType || template.billingType) as 'fixed' | 'hourly' | 'retainer',
    revisions_included: template.revisionsIncluded,
    due_date: dueDate,
  }

  // Milestones
  const createdMilestones: any[] = []
  const milestoneIds: string[] = []

  for (let i = 0; i < template.milestones.length; i++) {
    const tm = template.milestones[i]
    const mId = generateId('ms')
    milestoneIds.push(mId)

    const mDueDate = addDays(project.startDate, tm.offsetDays)
    let amountMinor: number | null = null
    if (project.budgetMinor && tm.amountPct != null) {
      amountMinor = Math.round((project.budgetMinor * tm.amountPct) / 100)
    }

    createdMilestones.push({
      id: mId,
      project_id: project.id,
      title: tm.title,
      position: (i + 1) * 1024,
      due_date: mDueDate,
      amount_minor: amountMinor,
      status: 'open',
      created_at: now,
      updated_at: now,
    })
  }

  // Tasks
  const createdTasks: any[] = []
  for (let j = 0; j < template.tasks.length; j++) {
    const tt = template.tasks[j]
    const tId = generateId('tsk')
    const milestoneId =
      tt.milestoneIndex != null && tt.milestoneIndex < milestoneIds.length
        ? milestoneIds[tt.milestoneIndex]
        : null
    const tDueDate =
      tt.offsetDays != null ? addDays(project.startDate, tt.offsetDays) : null

    createdTasks.push({
      id: tId,
      project_id: project.id,
      milestone_id: milestoneId,
      title: tt.title,
      notes: null,
      kind: 'task',
      revision_round: null,
      source_activity_id: null,
      due_date: tDueDate,
      focus_date: null,
      position: (j + 1) * 1024,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
  }

  // Invoices from payment schedule
  const createdInvoices: any[] = []
  const scheduled = scheduleInvoices(
    template.paymentSchedule,
    project.budgetMinor,
    template.milestones,
    project.startDate
  )

  for (let k = 0; k < scheduled.length; k++) {
    const draft = scheduled[k]
    const invId = generateId('inv')
    const milestoneId =
      draft.milestoneIndex != null && draft.milestoneIndex < milestoneIds.length
        ? milestoneIds[draft.milestoneIndex]
        : null

    createdInvoices.push({
      id: invId,
      project_id: project.id,
      milestone_id: milestoneId,
      number: null,
      label: draft.label,
      amount_minor: draft.amountMinor,
      currency: project.currency,
      hours: null,
      status: 'draft',
      issue_date: null,
      due_date: null,
      paid_date: null,
      external_url: null,
      notes: null,
      created_at: now,
      updated_at: now,
    })
  }

  return {
    projectPatch,
    milestones: createdMilestones,
    tasks: createdTasks,
    invoices: createdInvoices,
  }
}

export function saveAsTemplate(
  project: {
    startDate: string | null
    dueDate: string | null
    budgetMinor: number | null
    billingType: 'fixed' | 'hourly' | 'retainer'
    revisionsIncluded: number | null
  },
  milestones: Array<{ id: string; title: string; dueDate: string | null; amountMinor: number | null; position: number }>,
  tasks: Array<{ title: string; milestoneId: string | null; dueDate: string | null; kind: string; position: number }>,
  name: string
): {
  name: string
  billingType: 'fixed' | 'hourly' | 'retainer'
  paymentSchedule: 'none'
  durationDays: number | null
  revisionsIncluded: number | null
  milestones: TemplateMilestone[]
  tasks: TemplateTask[]
} {
  const startDate = project.startDate || new Date().toISOString().slice(0, 10)
  const durationDays =
    project.dueDate && project.startDate
      ? Math.max(0, diffDays(project.startDate, project.dueDate))
      : null

  const sortedMilestones = [...milestones].sort((a, b) => a.position - b.position)
  const templateMilestones: TemplateMilestone[] = sortedMilestones.map((m) => {
    const offsetDays = m.dueDate ? Math.max(0, diffDays(startDate, m.dueDate)) : 0
    let amountPct: number | null = null
    if (project.budgetMinor && project.budgetMinor > 0 && m.amountMinor) {
      amountPct = Math.round((m.amountMinor / project.budgetMinor) * 100)
    }
    return {
      title: m.title,
      offsetDays,
      amountPct,
    }
  })

  // Open + completed tasks (exclude revision tasks)
  const nonRevisionTasks = tasks.filter((t) => t.kind !== 'revision')
  const sortedTasks = [...nonRevisionTasks].sort((a, b) => a.position - b.position)

  const templateTasks: TemplateTask[] = sortedTasks.map((t) => {
    let milestoneIndex: number | null = null
    if (t.milestoneId) {
      const idx = sortedMilestones.findIndex((m) => m.id === t.milestoneId)
      if (idx !== -1) milestoneIndex = idx
    }
    const offsetDays = t.dueDate ? Math.max(0, diffDays(startDate, t.dueDate)) : null
    return {
      title: t.title,
      milestoneIndex,
      offsetDays,
    }
  })

  return {
    name,
    billingType: project.billingType,
    paymentSchedule: 'none',
    durationDays,
    revisionsIncluded: project.revisionsIncluded,
    milestones: templateMilestones,
    tasks: templateTasks,
  }
}

/**
 * Calculates next month retainer milestone and optional draft invoice per §8.7
 */
export function buildNextMonthRetainer(
  project: { id: string; budgetMinor?: number | null; budget_minor?: number | null; currency: string; startDate?: string | null },
  existingMilestones: Array<{ title: string; dueDate?: string | null; due_date?: string | null; position: number }>,
  now: string
): { milestone: any; invoice: any | null } {
  const budget =
    project.budgetMinor !== undefined ? project.budgetMinor : project.budget_minor ?? null

  // Month names for parsing
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]

  let latestYear = 0
  let latestMonth = -1 // 0-indexed

  for (const m of existingMilestones) {
    // Try to match "{Month YYYY}" from title
    const match = m.title.trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
    if (match) {
      const mIdx = months.indexOf(match[1].toLowerCase())
      const yr = parseInt(match[2], 10)
      if (mIdx !== -1 && (yr > latestYear || (yr === latestYear && mIdx > latestMonth))) {
        latestYear = yr
        latestMonth = mIdx
      }
    }
    // Also check dueDate
    const d = m.dueDate || m.due_date
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [yr, mo] = d.split('-').map(Number)
      const mIdx = mo - 1
      if (yr > latestYear || (yr === latestYear && mIdx > latestMonth)) {
        latestYear = yr
        latestMonth = mIdx
      }
    }
  }

  // If no previous month found, start from today/startDate
  if (latestYear === 0) {
    const ref = project.startDate || now.slice(0, 10)
    const [yr, mo] = ref.split('-').map(Number)
    latestYear = yr
    latestMonth = mo - 1
  }

  // Next month
  let nextMonth = latestMonth + 1
  let nextYear = latestYear
  if (nextMonth > 11) {
    nextMonth = 0
    nextYear++
  }

  const dateObj = new Date(Date.UTC(nextYear, nextMonth, 1))
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  const milestoneTitle = `${monthName} ${nextYear}`

  // Last day of next month
  const lastDayDate = new Date(Date.UTC(nextYear, nextMonth + 1, 0))
  const lastDay = String(lastDayDate.getUTCDate()).padStart(2, '0')
  const moStr = String(nextMonth + 1).padStart(2, '0')
  const milestoneDueDate = `${nextYear}-${moStr}-${lastDay}`

  const maxPosition = existingMilestones.reduce((max, m) => Math.max(max, m.position), 0)
  const milestonePosition = maxPosition + 1024

  const mId = generateId('ms')
  const milestone = {
    id: mId,
    project_id: project.id,
    title: milestoneTitle,
    position: milestonePosition,
    due_date: milestoneDueDate,
    amount_minor: budget,
    status: 'open',
    created_at: now,
    updated_at: now,
  }

  let invoice: any | null = null
  if (budget && budget > 0) {
    invoice = {
      id: generateId('inv'),
      project_id: project.id,
      milestone_id: mId,
      number: null,
      label: `${milestoneTitle} retainer`,
      amount_minor: budget,
      currency: project.currency,
      hours: null,
      status: 'draft',
      issue_date: null,
      due_date: null,
      paid_date: null,
      external_url: null,
      notes: null,
      created_at: now,
      updated_at: now,
    }
  }

  return { milestone, invoice }
}
