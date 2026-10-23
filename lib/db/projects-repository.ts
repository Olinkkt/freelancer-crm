import { sql } from 'kysely'
import { db } from './client'
import { ensureDbInitialized } from './init'
import type {
  ProjectsTable,
  ProjectStagesTable,
  ProjectMilestonesTable,
  ProjectTasksTable,
  InvoicesTable,
  ProjectTemplatesTable,
} from './schema'
import type {
  Project,
  ProjectStage,
  Milestone,
  Task,
  Invoice,
  ProjectTemplate,
  ProjectCard,
  ProjectDetail,
  ProjectMoney,
} from '@/lib/projects/types'
import { projectMoney, isOverdue } from '@/lib/projects/money'
import { diffDays } from '@/lib/projects/dates'

export function mapProjectStageRow(r: any): ProjectStage {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    position: Number(r.position),
    color: r.color,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapProjectRow(r: any): Project {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    companyId: r.company_id ?? null,
    dealId: r.deal_id ?? null,
    contactName: r.contact_name ?? null,
    contactEmail: r.contact_email ?? null,
    stageId: r.stage_id,
    billingType: r.billing_type,
    currency: r.currency,
    budgetMinor: r.budget_minor !== null && r.budget_minor !== undefined ? Number(r.budget_minor) : null,
    hourlyRateMinor: r.hourly_rate_minor !== null && r.hourly_rate_minor !== undefined ? Number(r.hourly_rate_minor) : null,
    estimateHours: r.estimate_hours !== null && r.estimate_hours !== undefined ? Number(r.estimate_hours) : null,
    revisionsIncluded: r.revisions_included !== null && r.revisions_included !== undefined ? Number(r.revisions_included) : null,
    startDate: r.start_date ?? null,
    dueDate: r.due_date ?? null,
    waitingSinceDate: r.waiting_since_date ?? null,
    health: r.health ?? null,
    brief: r.brief ?? '',
    templateId: r.template_id ?? null,
    closeOutcome: r.close_outcome ?? null,
    closeReason: r.close_reason ?? null,
    stageChangedAt: r.stage_changed_at,
    deliveredAt: r.delivered_at ?? null,
    closedAt: r.closed_at ?? null,
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapMilestoneRow(r: any): Milestone {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    position: Number(r.position),
    dueDate: r.due_date ?? null,
    amountMinor: r.amount_minor !== null && r.amount_minor !== undefined ? Number(r.amount_minor) : null,
    status: r.status,
    deliveredAt: r.delivered_at ?? null,
    approvedAt: r.approved_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapTaskRow(r: any): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    milestoneId: r.milestone_id ?? null,
    title: r.title,
    notes: r.notes ?? null,
    kind: r.kind,
    revisionRound: r.revision_round !== null && r.revision_round !== undefined ? Number(r.revision_round) : null,
    sourceActivityId: r.source_activity_id ?? null,
    dueDate: r.due_date ?? null,
    focusDate: r.focus_date ?? null,
    position: Number(r.position),
    completedAt: r.completed_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapInvoiceRow(r: any): Invoice {
  return {
    id: r.id,
    projectId: r.project_id,
    milestoneId: r.milestone_id ?? null,
    number: r.number ?? null,
    label: r.label,
    amountMinor: Number(r.amount_minor),
    currency: r.currency,
    hours: r.hours !== null && r.hours !== undefined ? Number(r.hours) : null,
    status: r.status,
    issueDate: r.issue_date ?? null,
    dueDate: r.due_date ?? null,
    paidDate: r.paid_date ?? null,
    externalUrl: r.external_url ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapTemplateRow(r: any): ProjectTemplate {
  let milestones = []
  let tasks = []
  try {
    milestones = JSON.parse(r.milestones_json || '[]')
  } catch {}
  try {
    tasks = JSON.parse(r.tasks_json || '[]')
  } catch {}

  return {
    id: r.id,
    name: r.name,
    billingType: r.billing_type,
    paymentSchedule: r.payment_schedule,
    durationDays: r.duration_days !== null && r.duration_days !== undefined ? Number(r.duration_days) : null,
    revisionsIncluded: r.revisions_included !== null && r.revisions_included !== undefined ? Number(r.revisions_included) : null,
    milestones,
    tasks,
    isBuiltin: Boolean(r.is_builtin),
    position: Number(r.position),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function getProjectConfig() {
  await ensureDbInitialized()
  const [stages, templates] = await Promise.all([
    db.selectFrom('project_stages').selectAll().orderBy('position', 'asc').execute(),
    db.selectFrom('project_templates').selectAll().orderBy('position', 'asc').execute(),
  ])
  return {
    stages: stages.map(mapProjectStageRow),
    templates: templates.map(mapTemplateRow),
  }
}

export async function insertProjectGraph(graph: {
  project: any
  milestones?: any[]
  tasks?: any[]
  invoices?: any[]
}): Promise<void> {
  await ensureDbInitialized()

  // Invariant I1: At most one project per deal
  if (graph.project.deal_id) {
    const existing = await db
      .selectFrom('projects')
      .select('id')
      .where('deal_id', '=', graph.project.deal_id)
      .executeTakeFirst()
    if (existing) {
      const err = new Error('This deal already has a project')
      ;(err as any).code = 'DEAL_ALREADY_HAS_PROJECT'
      ;(err as any).details = { projectId: existing.id }
      throw err
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx.insertInto('projects').values(graph.project).execute()

    if (graph.milestones && graph.milestones.length > 0) {
      await trx.insertInto('project_milestones').values(graph.milestones).execute()
    }
    if (graph.tasks && graph.tasks.length > 0) {
      await trx.insertInto('project_tasks').values(graph.tasks).execute()
    }
    if (graph.invoices && graph.invoices.length > 0) {
      await trx.insertInto('invoices').values(graph.invoices).execute()
    }
  })
}

export async function deleteProject(id: string): Promise<void> {
  await ensureDbInitialized()
  // Invariant I9: Deleting a project deletes its tasks, milestones and invoices, and nulls activities.project_id (one transaction)
  await db.transaction().execute(async (trx) => {
    await trx.updateTable('activities').set({ project_id: null }).where('project_id', '=', id).execute()
    await trx.deleteFrom('project_tasks').where('project_id', '=', id).execute()
    await trx.deleteFrom('invoices').where('project_id', '=', id).execute()
    await trx.deleteFrom('project_milestones').where('project_id', '=', id).execute()
    await trx.deleteFrom('projects').where('id', '=', id).execute()
  })
}

export async function listProjectCards(opts: { includeArchived: boolean; today: string }): Promise<ProjectCard[]> {
  await ensureDbInitialized()
  const today = opts.today

  let query = db.selectFrom('projects').selectAll()
  if (!opts.includeArchived) {
    query = query.where('archived_at', 'is', null)
  }
  const projectRows = await query.orderBy('created_at', 'desc').execute()
  if (projectRows.length === 0) return []

  const projectIds = projectRows.map((p) => p.id)

  const [stages, tasks, milestones, invoices] = await Promise.all([
    db.selectFrom('project_stages').selectAll().execute(),
    db.selectFrom('project_tasks').selectAll().where('project_id', 'in', projectIds).execute(),
    db.selectFrom('project_milestones').selectAll().where('project_id', 'in', projectIds).execute(),
    db.selectFrom('invoices').selectAll().where('project_id', 'in', projectIds).execute(),
  ])

  const stageMap = new Map<string, ProjectStage>()
  for (const s of stages) {
    stageMap.set(s.id, mapProjectStageRow(s))
  }

  const tasksByProject = new Map<string, any[]>()
  for (const t of tasks) {
    if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, [])
    tasksByProject.get(t.project_id)!.push(t)
  }

  const milestonesByProject = new Map<string, any[]>()
  for (const m of milestones) {
    if (!milestonesByProject.has(m.project_id)) milestonesByProject.set(m.project_id, [])
    milestonesByProject.get(m.project_id)!.push(m)
  }

  const invoicesByProject = new Map<string, any[]>()
  for (const inv of invoices) {
    if (!invoicesByProject.has(inv.project_id)) invoicesByProject.set(inv.project_id, [])
    invoicesByProject.get(inv.project_id)!.push(inv)
  }

  return projectRows.map((pRow) => {
    const project = mapProjectRow(pRow)
    const stage = stageMap.get(pRow.stage_id) || {
      id: pRow.stage_id,
      name: 'Unknown',
      category: 'planned',
      position: 0,
      color: 'gray',
      createdAt: pRow.created_at,
      updatedAt: pRow.updated_at,
    }

    const pTasks = tasksByProject.get(pRow.id) || []
    const pMilestones = milestonesByProject.get(pRow.id) || []
    const pInvoices = invoicesByProject.get(pRow.id) || []

    let openTasks = 0
    let doneTasks = 0
    let overdueTasks = 0
    let maxRevisionRound: number | null = null
    const openTasksList: any[] = []

    for (const t of pTasks) {
      if (t.completed_at) {
        doneTasks++
      } else {
        openTasks++
        openTasksList.push(t)
        if (t.due_date && t.due_date < today) {
          overdueTasks++
        }
      }
      if (t.revision_round) {
        maxRevisionRound = Math.max(maxRevisionRound || 0, t.revision_round)
      }
    }

    // nextTask: open task with due_date or focus_date closest to today
    openTasksList.sort((a, b) => {
      const dateA = a.due_date || a.focus_date || '9999-99-99'
      const dateB = b.due_date || b.focus_date || '9999-99-99'
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return a.position - b.position
    })
    const firstNext = openTasksList[0]
    const nextTask = firstNext
      ? {
          id: firstNext.id,
          title: firstNext.title,
          dueDate: firstNext.due_date ?? null,
          focusDate: firstNext.focus_date ?? null,
        }
      : null

    // currentMilestone: first non-approved by position
    const sortedMilestones = [...pMilestones].sort((a, b) => a.position - b.position)
    const nonApproved = sortedMilestones.find((m) => m.status !== 'approved')
    const currentMilestone = nonApproved
      ? { id: nonApproved.id, title: nonApproved.title, dueDate: nonApproved.due_date ?? null }
      : null

    const money = projectMoney(pRow, pInvoices)

    const waitingDays = pRow.waiting_since_date ? diffDays(pRow.waiting_since_date, today) : null

    // needsNextStep: active-category project with no open task that has a due_date or focus_date
    const hasDatedTask = openTasksList.some((t) => t.due_date || t.focus_date)
    const needsNextStep = stage.category === 'active' && !hasDatedTask

    const hasOverdueInvoice = pInvoices.some((inv) => isOverdue(inv, today))

    return {
      project,
      stage,
      openTasks,
      doneTasks,
      overdueTasks,
      nextTask,
      currentMilestone,
      money,
      waitingDays,
      needsNextStep,
      revisionRound: maxRevisionRound,
      hasOverdueInvoice,
    }
  })
}

export async function getProjectDetail(id: string, today: string): Promise<ProjectDetail | null> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!pRow) return null

  const [stages, milestones, tasks, invoices, activities] = await Promise.all([
    db.selectFrom('project_stages').selectAll().orderBy('position', 'asc').execute(),
    db.selectFrom('project_milestones').selectAll().where('project_id', '=', id).orderBy('position', 'asc').execute(),
    db.selectFrom('project_tasks').selectAll().where('project_id', '=', id).orderBy('position', 'asc').execute(),
    db.selectFrom('invoices').selectAll().where('project_id', '=', id).orderBy('created_at', 'asc').execute(),
    db
      .selectFrom('activities')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('project_id', '=', id),
          ...(pRow.deal_id ? [eb('deal_id', '=', pRow.deal_id)] : []),
        ])
      )
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute(),
  ])

  let deal: { id: string; title: string; stage: string } | null = null
  if (pRow.deal_id) {
    const dRow = await db
      .selectFrom('deals')
      .select(['id', 'title', 'stage'])
      .where('id', '=', pRow.deal_id)
      .executeTakeFirst()
    if (dRow) {
      deal = { id: dRow.id, title: dRow.title, stage: dRow.stage }
    }
  }

  const project = mapProjectRow(pRow)
  const mappedStages = stages.map(mapProjectStageRow)
  const mappedMilestones = milestones.map(mapMilestoneRow)
  const mappedTasks = tasks.map(mapTaskRow)
  const mappedInvoices = invoices.map(mapInvoiceRow)

  const cards = await listProjectCards({ includeArchived: true, today })
  const card = cards.find((c) => c.project.id === id)!

  return {
    project,
    stages: mappedStages,
    milestones: mappedMilestones,
    tasks: mappedTasks,
    invoices: mappedInvoices,
    activities,
    deal,
    money: card.money,
    card,
  }
}
