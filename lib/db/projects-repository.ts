import { sql } from 'kysely'
import { db } from './client'
import { ensureDbInitialized } from './init'
import { generateId } from './ids'
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
  TodayData,
  MilestoneStatus,
  InvoiceStatus,
} from '@/lib/projects/types'
import { projectMoney, isOverdue } from '@/lib/projects/money'
import { diffDays, addDays } from '@/lib/projects/dates'
import { DomainError } from '@/lib/projects/action-result'
import { planStageChange } from '@/lib/projects/stage-machine'
import { positionBetween, isGapTooSmall, renormalisePositions, POSITION_STEP } from '@/lib/projects/position'
import { buildTemplateGraph, saveAsTemplate, buildNextMonthRetainer } from '@/lib/projects/templates'
import { calculateRevisionRound } from '@/lib/projects/feedback'
import { buildToday } from '@/lib/projects/today'
import { buildWeeklyReview, type WeeklyReviewData } from '@/lib/projects/review'
import type {
  createProjectInput,
  updateProjectInput,
  closeProjectInput,
  createTaskInput,
  updateTaskInput,
  moveTaskInput,
  createMilestoneInput,
  updateMilestoneInput,
  moveMilestoneInput,
  createInvoiceInput,
  updateInvoiceInput,
  logFeedbackInput,
  syncBriefInput,
  stageInput,
  templateInput,
  projectSettingsInput,
} from '@/lib/validations/projects'
import { z } from 'zod'

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

export async function getWorkspaceSettings() {
  await ensureDbInitialized()
  return await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
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

// -------------------------------------------------------------
// PROJECT REPOSITORY OPERATIONS (§9.4)
// -------------------------------------------------------------

export async function touchProject(projectId: string, now: string, trx?: any): Promise<void> {
  const runner = trx ?? db
  await runner
    .updateTable('projects')
    .set({ updated_at: now })
    .where('id', '=', projectId)
    .execute()
}

export async function createProject(
  input: z.infer<typeof createProjectInput>,
  now: string
): Promise<ProjectDetail> {
  await ensureDbInitialized()

  // Invariant I1: Deal can only have one project
  if (input.dealId) {
    const existing = await db
      .selectFrom('projects')
      .select('id')
      .where('deal_id', '=', input.dealId)
      .executeTakeFirst()
    if (existing) {
      throw new DomainError('DEAL_ALREADY_HAS_PROJECT', 'This deal already has a project', {
        projectId: existing.id,
      })
    }
  }

  // Find first stage in 'planned' category
  const plannedStage = await db
    .selectFrom('project_stages')
    .selectAll()
    .where('category', '=', 'planned')
    .orderBy('position', 'asc')
    .executeTakeFirst()
  if (!plannedStage) {
    throw new DomainError('NOT_FOUND', 'No planned stage found in system')
  }

  // Load template
  const templateRow = await db
    .selectFrom('project_templates')
    .selectAll()
    .where('id', '=', input.templateId)
    .executeTakeFirst()
  if (!templateRow) {
    throw new DomainError('NOT_FOUND', `Template ${input.templateId} not found`)
  }
  const template = mapTemplateRow(templateRow)

  // Deal copy fields (R4)
  let companyId: string | null = null
  let currency = 'USD'
  const settingsRow = await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
  if (settingsRow?.currency) {
    currency = settingsRow.currency
  }

  if (input.dealId) {
    const dealRow = await db.selectFrom('deals').selectAll().where('id', '=', input.dealId).executeTakeFirst()
    if (!dealRow) {
      throw new DomainError('NOT_FOUND', `Deal ${input.dealId} not found`)
    }
    companyId = dealRow.company_id ?? null
  }

  const pId = input.dealId ? `prj-${input.dealId}` : generateId('prj')

  const projectBase = {
    id: pId,
    title: input.title,
    company: input.company,
    company_id: companyId,
    deal_id: input.dealId,
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    stage_id: plannedStage.id,
    billing_type: input.billingType || template.billingType,
    currency,
    budget_minor: input.budgetMinor,
    hourly_rate_minor: input.hourlyRateMinor,
    estimate_hours: input.estimateHours,
    revisions_included: template.revisionsIncluded,
    start_date: input.startDate,
    due_date: input.dueDate,
    waiting_since_date: null,
    health: null,
    brief: '',
    template_id: template.id,
    close_outcome: null,
    close_reason: null,
    stage_changed_at: now,
    delivered_at: null,
    closed_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  }

  // Build template graph
  const graph = buildTemplateGraph({
    project: {
      id: pId,
      startDate: input.startDate,
      dueDate: input.dueDate,
      budgetMinor: input.budgetMinor,
      currency,
      billingType: input.billingType || template.billingType,
    },
    template: {
      ...template,
      paymentSchedule: input.paymentSchedule || template.paymentSchedule,
    },
    now,
  })

  // Merge patch from graph (e.g. calculated due_date)
  const finalProject = {
    ...projectBase,
    billing_type: graph.projectPatch.billing_type,
    revisions_included: graph.projectPatch.revisions_included,
    due_date: graph.projectPatch.due_date ?? projectBase.due_date,
  }

  await insertProjectGraph({
    project: finalProject,
    milestones: graph.milestones,
    tasks: graph.tasks,
    invoices: graph.invoices,
  })

  const detail = await getProjectDetail(pId, input.today)
  if (!detail) {
    throw new DomainError('INTERNAL', 'Failed to retrieve newly created project')
  }
  return detail
}

export async function updateProject(
  id: string,
  patch: z.infer<typeof updateProjectInput>['patch'],
  now: string
): Promise<Project> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Project ${id} not found`)
  }

  const updates: any = { updated_at: now }
  if (patch.title !== undefined) updates.title = patch.title
  if (patch.company !== undefined) updates.company = patch.company
  if (patch.contactName !== undefined) updates.contact_name = patch.contactName
  if (patch.contactEmail !== undefined) updates.contact_email = patch.contactEmail
  if (patch.billingType !== undefined) updates.billing_type = patch.billingType
  if (patch.currency !== undefined) updates.currency = patch.currency
  if (patch.budgetMinor !== undefined) updates.budget_minor = patch.budgetMinor
  if (patch.hourlyRateMinor !== undefined) updates.hourly_rate_minor = patch.hourlyRateMinor
  if (patch.estimateHours !== undefined) updates.estimate_hours = patch.estimateHours
  if (patch.revisionsIncluded !== undefined) updates.revisions_included = patch.revisionsIncluded
  if (patch.startDate !== undefined) updates.start_date = patch.startDate
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate
  if (patch.health !== undefined) updates.health = patch.health
  if (patch.brief !== undefined) updates.brief = patch.brief

  await db.updateTable('projects').set(updates).where('id', '=', id).execute()
  const updatedRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapProjectRow(updatedRow)
}

export async function moveProjectStage(
  id: string,
  stageId: string,
  today: string,
  now: string
): Promise<{ project: Project; stage: ProjectStage; fromStage: ProjectStage }> {
  await ensureDbInitialized()
  const projectRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!projectRow) {
    throw new DomainError('NOT_FOUND', `Project ${id} not found`)
  }

  const stages = await db.selectFrom('project_stages').selectAll().execute()
  const fromStageRow = stages.find((s) => s.id === projectRow.stage_id)
  const toStageRow = stages.find((s) => s.id === stageId)

  if (!fromStageRow || !toStageRow) {
    throw new DomainError('NOT_FOUND', 'Stage not found')
  }

  const fromStage = mapProjectStageRow(fromStageRow)
  const toStage = mapProjectStageRow(toStageRow)

  const plan = planStageChange(projectRow, fromStage, toStage, now, today)
  if (!plan.ok) {
    throw new DomainError(plan.code, `Stage transition not allowed: ${plan.code}`)
  }

  await db.updateTable('projects').set(plan.patch).where('id', '=', id).execute()
  const updatedRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return {
    project: mapProjectRow(updatedRow),
    stage: toStage,
    fromStage,
  }
}

export async function toggleProjectWaiting(id: string, today: string, now: string): Promise<Project> {
  await ensureDbInitialized()
  const projectRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!projectRow) {
    throw new DomainError('NOT_FOUND', `Project ${id} not found`)
  }

  const newWaiting = projectRow.waiting_since_date ? null : today
  await db
    .updateTable('projects')
    .set({ waiting_since_date: newWaiting, updated_at: now })
    .where('id', '=', id)
    .execute()

  const updatedRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapProjectRow(updatedRow)
}

export async function closeProject(
  input: z.infer<typeof closeProjectInput>,
  now: string
): Promise<Project> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!pRow) {
    throw new DomainError('NOT_FOUND', `Project ${input.id} not found`)
  }

  const closedStage = await db
    .selectFrom('project_stages')
    .selectAll()
    .where('category', '=', 'closed')
    .orderBy('position', 'asc')
    .executeTakeFirst()
  if (!closedStage) {
    throw new DomainError('NOT_FOUND', 'No closed stage found')
  }

  // Load project's current invoices
  const invoices = await db.selectFrom('invoices').selectAll().where('project_id', '=', input.id).execute()

  return await db.transaction().execute(async (trx) => {
    // 1. Mark markPaidInvoiceIds paid
    if (input.markPaidInvoiceIds.length > 0) {
      await trx
        .updateTable('invoices')
        .set({ status: 'paid', paid_date: input.today, updated_at: now })
        .where('project_id', '=', input.id)
        .where('id', 'in', input.markPaidInvoiceIds)
        .execute()
    }

    // 2. Check remaining draft / sent invoices
    const paidSet = new Set(input.markPaidInvoiceIds)
    const remainingOpenInvoices = invoices.filter(
      (inv) => !paidSet.has(inv.id) && (inv.status === 'draft' || inv.status === 'sent')
    )

    if (remainingOpenInvoices.length > 0) {
      if (input.invoiceResolution === 'none') {
        throw new DomainError('INVOICES_UNRESOLVED', 'There are unpaid invoices', {
          openInvoiceIds: remainingOpenInvoices.map((inv) => inv.id),
        })
      } else if (input.invoiceResolution === 'void_open') {
        await trx
          .updateTable('invoices')
          .set({ status: 'void', updated_at: now })
          .where('project_id', '=', input.id)
          .where('id', 'in', remainingOpenInvoices.map((inv) => inv.id))
          .execute()
      }
      // If leave_open, leave them as they are
    }

    // 3. Open tasks
    if (input.openTasks === 'complete') {
      await trx
        .updateTable('project_tasks')
        .set({ completed_at: now, updated_at: now })
        .where('project_id', '=', input.id)
        .where('completed_at', 'is', null)
        .execute()
    } else if (input.openTasks === 'delete') {
      await trx
        .deleteFrom('project_tasks')
        .where('project_id', '=', input.id)
        .where('completed_at', 'is', null)
        .execute()
    }

    // 4. Update stage to closed with T9 patch
    const deliveredAt =
      pRow.delivered_at ?? (input.outcome === 'completed' ? now : null)

    const patch: any = {
      stage_id: closedStage.id,
      stage_changed_at: now,
      closed_at: now,
      close_outcome: input.outcome,
      close_reason: input.reason,
      delivered_at: deliveredAt,
      waiting_since_date: null,
      health: null,
      updated_at: now,
    }
    if (input.archive) {
      patch.archived_at = now
    }

    await trx.updateTable('projects').set(patch).where('id', '=', input.id).execute()

    // 5. Follow-ups
    if (input.followUps.testimonial) {
      const contactLabel = pRow.contact_name || pRow.company
      await trx.insertInto('follow_ups').values({
        id: generateId('fu'),
        deal_id: pRow.deal_id,
        day: 'This week',
        company: pRow.company,
        action: `Ask ${contactLabel} for a testimonial`,
        time: '12:00',
        tone: 'normal',
        completed: 0,
        created_at: now,
      }).execute()
    }
    if (input.followUps.retainer) {
      await trx.insertInto('follow_ups').values({
        id: generateId('fu'),
        deal_id: pRow.deal_id,
        day: 'Next week',
        company: pRow.company,
        action: `Pitch a retainer to ${pRow.company}`,
        time: '12:00',
        tone: 'normal',
        completed: 0,
        created_at: now,
      }).execute()
    }
    if (input.followUps.checkIn) {
      await trx.insertInto('follow_ups').values({
        id: generateId('fu'),
        deal_id: pRow.deal_id,
        day: 'Later',
        company: pRow.company,
        action: `Check in with ${pRow.company}`,
        time: '12:00',
        tone: 'normal',
        completed: 0,
        created_at: now,
      }).execute()
    }

    // 6. Activity note
    await trx.insertInto('activities').values({
      id: generateId('act'),
      deal_id: pRow.deal_id,
      project_id: input.id,
      type: 'Note',
      title: `Project closed: ${input.outcome}`,
      person: pRow.contact_name || 'System',
      company: pRow.company,
      date: input.today,
      status: 'Completed',
      color: 'gray',
      summary: input.reason || null,
      created_at: now,
    }).execute()

    // 7. Save as template
    if (input.saveAsTemplateName) {
      const mRows = await trx.selectFrom('project_milestones').selectAll().where('project_id', '=', input.id).execute()
      const tRows = await trx.selectFrom('project_tasks').selectAll().where('project_id', '=', input.id).execute()
      const tplData = saveAsTemplate(
        {
          startDate: pRow.start_date,
          dueDate: pRow.due_date,
          budgetMinor: pRow.budget_minor,
          billingType: pRow.billing_type as any,
          revisionsIncluded: pRow.revisions_included,
        },
        mRows.map(mapMilestoneRow),
        tRows.map(mapTaskRow),
        input.saveAsTemplateName
      )

      const maxTpl = await trx.selectFrom('project_templates').select('position').orderBy('position', 'desc').executeTakeFirst()
      const tplPos = (maxTpl?.position ?? 0) + 1024

      await trx.insertInto('project_templates').values({
        id: generateId('tpl'),
        name: tplData.name,
        billing_type: tplData.billingType,
        payment_schedule: tplData.paymentSchedule,
        duration_days: tplData.durationDays,
        revisions_included: tplData.revisionsIncluded,
        milestones_json: JSON.stringify(tplData.milestones),
        tasks_json: JSON.stringify(tplData.tasks),
        is_builtin: 0,
        position: tplPos,
        created_at: now,
        updated_at: now,
      }).execute()
    }

    const updatedRow = await trx.selectFrom('projects').selectAll().where('id', '=', input.id).executeTakeFirstOrThrow()
    return mapProjectRow(updatedRow)
  })
}

export async function reopenProject(id: string, now: string): Promise<Project> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!pRow) {
    throw new DomainError('NOT_FOUND', `Project ${id} not found`)
  }

  const stages = await db.selectFrom('project_stages').selectAll().execute()
  const currentStage = stages.find((s) => s.id === pRow.stage_id)
  if (currentStage?.category !== 'closed') {
    throw new DomainError('STAGE_TRANSITION_NOT_ALLOWED', 'Project is not in closed stage')
  }

  const activeStage = stages.find((s) => s.category === 'active')
  if (!activeStage) {
    throw new DomainError('NOT_FOUND', 'No active stage found')
  }

  // T11 patch
  const patch = {
    stage_id: activeStage.id,
    stage_changed_at: now,
    closed_at: null,
    close_outcome: null,
    close_reason: null,
    delivered_at: null,
    archived_at: null,
    updated_at: now,
  }

  await db.updateTable('projects').set(patch).where('id', '=', id).execute()
  const updated = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapProjectRow(updated)
}

export async function archiveProject(id: string, archived: boolean, now: string): Promise<Project> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst()
  if (!pRow) {
    throw new DomainError('NOT_FOUND', `Project ${id} not found`)
  }

  const currentStage = await db.selectFrom('project_stages').selectAll().where('id', '=', pRow.stage_id).executeTakeFirst()
  if (archived && currentStage?.category !== 'delivered' && currentStage?.category !== 'closed') {
    throw new DomainError('ARCHIVE_NOT_ALLOWED', 'Only delivered or closed projects can be archived')
  }

  await db
    .updateTable('projects')
    .set({ archived_at: archived ? now : null, updated_at: now })
    .where('id', '=', id)
    .execute()

  const updated = await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapProjectRow(updated)
}

// -------------------------------------------------------------
// TASKS OPERATIONS
// -------------------------------------------------------------

export async function createTask(
  input: z.infer<typeof createTaskInput>,
  now: string
): Promise<Task> {
  await ensureDbInitialized()
  const project = await db.selectFrom('projects').select('id').where('id', '=', input.projectId).executeTakeFirst()
  if (!project) {
    throw new DomainError('NOT_FOUND', `Project ${input.projectId} not found`)
  }

  // Invariant I3: milestoneId belongs to project
  if (input.milestoneId) {
    const ms = await db
      .selectFrom('project_milestones')
      .selectAll()
      .where('id', '=', input.milestoneId)
      .executeTakeFirst()
    if (!ms || ms.project_id !== input.projectId) {
      throw new DomainError('VALIDATION', 'Milestone does not belong to project')
    }
  }

  // Find tasks in the same milestone group
  let groupTasks = await db
    .selectFrom('project_tasks')
    .selectAll()
    .where('project_id', '=', input.projectId)
    .where(
      input.milestoneId ? 'milestone_id' : sql`milestone_id IS NULL`,
      input.milestoneId ? '=' : sql``,
      input.milestoneId ?? sql``
    )
    .orderBy('position', 'asc')
    .execute()

  let position = POSITION_STEP

  if (input.afterTaskId) {
    const afterIdx = groupTasks.findIndex((t) => t.id === input.afterTaskId)
    if (afterIdx !== -1) {
      const beforePos = groupTasks[afterIdx].position
      const afterPos = afterIdx + 1 < groupTasks.length ? groupTasks[afterIdx + 1].position : null
      position = positionBetween(beforePos, afterPos)

      if (isGapTooSmall(beforePos, afterPos)) {
        // Renormalise
        const renumbered = renormalisePositions(groupTasks)
        for (const item of renumbered) {
          await db.updateTable('project_tasks').set({ position: item.position }).where('id', '=', item.id).execute()
        }
        const updatedAfter = renumbered[afterIdx]
        const updatedNext = afterIdx + 1 < renumbered.length ? renumbered[afterIdx + 1] : null
        position = positionBetween(updatedAfter.position, updatedNext?.position ?? null)
      }
    }
  } else {
    // Top of group
    const firstPos = groupTasks.length > 0 ? groupTasks[0].position : null
    position = positionBetween(null, firstPos)
    if (isGapTooSmall(null, firstPos)) {
      const renumbered = renormalisePositions(groupTasks)
      for (const item of renumbered) {
        await db.updateTable('project_tasks').set({ position: item.position }).where('id', '=', item.id).execute()
      }
      position = positionBetween(null, renumbered[0]?.position ?? null)
    }
  }

  const tId = generateId('tsk')
  const newRow = {
    id: tId,
    project_id: input.projectId,
    milestone_id: input.milestoneId,
    title: input.title,
    notes: input.notes,
    kind: 'task' as const,
    revision_round: null,
    source_activity_id: null,
    due_date: input.dueDate,
    focus_date: input.focusDate,
    position,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('project_tasks').values(newRow).execute()
  await touchProject(input.projectId, now)
  return mapTaskRow(newRow)
}

export async function updateTask(
  id: string,
  patch: z.infer<typeof updateTaskInput>['patch'],
  now: string
): Promise<Task> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_tasks').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Task ${id} not found`)
  }

  if (patch.milestoneId !== undefined && patch.milestoneId !== null) {
    const ms = await db.selectFrom('project_milestones').selectAll().where('id', '=', patch.milestoneId).executeTakeFirst()
    if (!ms || ms.project_id !== existing.project_id) {
      throw new DomainError('VALIDATION', 'Milestone does not belong to project')
    }
  }

  const updates: any = { updated_at: now }
  if (patch.title !== undefined) updates.title = patch.title
  if (patch.notes !== undefined) updates.notes = patch.notes
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate
  if (patch.focusDate !== undefined) updates.focus_date = patch.focusDate
  if (patch.milestoneId !== undefined) updates.milestone_id = patch.milestoneId

  await db.updateTable('project_tasks').set(updates).where('id', '=', id).execute()
  await touchProject(existing.project_id, now)
  const updatedRow = await db.selectFrom('project_tasks').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapTaskRow(updatedRow)
}

export async function toggleTask(id: string, done: boolean, now: string): Promise<Task> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_tasks').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Task ${id} not found`)
  }

  await db
    .updateTable('project_tasks')
    .set({ completed_at: done ? now : null, updated_at: now })
    .where('id', '=', id)
    .execute()

  await touchProject(existing.project_id, now)
  const updatedRow = await db.selectFrom('project_tasks').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapTaskRow(updatedRow)
}

export async function moveTask(
  input: z.infer<typeof moveTaskInput>,
  now: string
): Promise<Task> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_tasks').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Task ${input.id} not found`)
  }

  const targetMilestoneId =
    input.milestoneId !== undefined ? input.milestoneId : existing.milestone_id

  if (targetMilestoneId) {
    const ms = await db.selectFrom('project_milestones').selectAll().where('id', '=', targetMilestoneId).executeTakeFirst()
    if (!ms || ms.project_id !== existing.project_id) {
      throw new DomainError('VALIDATION', 'Milestone does not belong to project')
    }
  }

  let beforePos: number | null = null
  let afterPos: number | null = null

  if (input.beforeId) {
    const beforeRow = await db.selectFrom('project_tasks').select('position').where('id', '=', input.beforeId).executeTakeFirst()
    if (beforeRow) beforePos = beforeRow.position
  }
  if (input.afterId) {
    const afterRow = await db.selectFrom('project_tasks').select('position').where('id', '=', input.afterId).executeTakeFirst()
    if (afterRow) afterPos = afterRow.position
  }

  let position = positionBetween(beforePos, afterPos)

  if (isGapTooSmall(beforePos, afterPos)) {
    // Renormalise tasks in the destination group
    const groupTasks = await db
      .selectFrom('project_tasks')
      .selectAll()
      .where('project_id', '=', existing.project_id)
      .where(
        targetMilestoneId ? 'milestone_id' : sql`milestone_id IS NULL`,
        targetMilestoneId ? '=' : sql``,
        targetMilestoneId ?? sql``
      )
      .orderBy('position', 'asc')
      .execute()

    const renumbered = renormalisePositions(groupTasks)
    for (const item of renumbered) {
      await db.updateTable('project_tasks').set({ position: item.position }).where('id', '=', item.id).execute()
    }

    const newBefore = input.beforeId ? renumbered.find((t) => t.id === input.beforeId)?.position ?? null : null
    const newAfter = input.afterId ? renumbered.find((t) => t.id === input.afterId)?.position ?? null : null
    position = positionBetween(newBefore, newAfter)
  }

  await db
    .updateTable('project_tasks')
    .set({
      milestone_id: targetMilestoneId,
      position,
      updated_at: now,
    })
    .where('id', '=', input.id)
    .execute()

  await touchProject(existing.project_id, now)
  const updatedRow = await db.selectFrom('project_tasks').selectAll().where('id', '=', input.id).executeTakeFirstOrThrow()
  return mapTaskRow(updatedRow)
}

export async function deleteTask(id: string, now: string): Promise<Task> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_tasks').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Task ${id} not found`)
  }

  await db.deleteFrom('project_tasks').where('id', '=', id).execute()
  await touchProject(existing.project_id, now)
  return mapTaskRow(existing)
}

export async function restoreTask(task: Task, now: string): Promise<Task> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_tasks').select('id').where('id', '=', task.id).executeTakeFirst()
  if (existing) {
    throw new DomainError('VALIDATION', `Task ${task.id} already exists`)
  }

  const row = {
    id: task.id,
    project_id: task.projectId,
    milestone_id: task.milestoneId,
    title: task.title,
    notes: task.notes,
    kind: task.kind,
    revision_round: task.revisionRound,
    source_activity_id: task.sourceActivityId,
    due_date: task.dueDate,
    focus_date: task.focusDate,
    position: task.position,
    completed_at: task.completedAt,
    created_at: task.createdAt,
    updated_at: now,
  }

  await db.insertInto('project_tasks').values(row).execute()
  await touchProject(task.projectId, now)
  return mapTaskRow(row)
}

// -------------------------------------------------------------
// MILESTONES OPERATIONS
// -------------------------------------------------------------

export async function createMilestone(
  input: z.infer<typeof createMilestoneInput>,
  now: string
): Promise<{ milestone: Milestone; invoice: Invoice | null }> {
  await ensureDbInitialized()
  const project = await db.selectFrom('projects').selectAll().where('id', '=', input.projectId).executeTakeFirst()
  if (!project) {
    throw new DomainError('NOT_FOUND', `Project ${input.projectId} not found`)
  }

  const existingMilestones = await db
    .selectFrom('project_milestones')
    .selectAll()
    .where('project_id', '=', input.projectId)
    .orderBy('position', 'asc')
    .execute()

  // Retainer with empty title -> next month retainer
  if (project.billing_type === 'retainer' && (!input.title || input.title.trim() === '')) {
    const res = buildNextMonthRetainer(
      {
        id: project.id,
        budget_minor: project.budget_minor,
        currency: project.currency,
        startDate: project.start_date,
      },
      existingMilestones,
      now
    )

    await db.transaction().execute(async (trx) => {
      await trx.insertInto('project_milestones').values(res.milestone).execute()
      if (res.invoice) {
        await trx.insertInto('invoices').values(res.invoice).execute()
      }
      await touchProject(project.id, now, trx)
    })

    return {
      milestone: mapMilestoneRow(res.milestone),
      invoice: res.invoice ? mapInvoiceRow(res.invoice) : null,
    }
  }

  const maxPos = existingMilestones.reduce((m, row) => Math.max(m, row.position), 0)
  const position = maxPos + POSITION_STEP

  const mId = generateId('ms')
  const newRow = {
    id: mId,
    project_id: input.projectId,
    title: input.title.trim() || 'Untitled milestone',
    position,
    due_date: input.dueDate,
    amount_minor: input.amountMinor,
    status: 'open' as const,
    delivered_at: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('project_milestones').values(newRow).execute()
  await touchProject(input.projectId, now)
  return {
    milestone: mapMilestoneRow(newRow),
    invoice: null,
  }
}

export async function updateMilestone(
  id: string,
  patch: z.infer<typeof updateMilestoneInput>['patch'],
  now: string
): Promise<Milestone> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_milestones').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Milestone ${id} not found`)
  }

  const updates: any = { updated_at: now }
  if (patch.title !== undefined) updates.title = patch.title
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate
  if (patch.amountMinor !== undefined) updates.amount_minor = patch.amountMinor

  await db.updateTable('project_milestones').set(updates).where('id', '=', id).execute()
  await touchProject(existing.project_id, now)
  const updatedRow = await db.selectFrom('project_milestones').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapMilestoneRow(updatedRow)
}

export async function setMilestoneStatus(
  id: string,
  status: MilestoneStatus,
  now: string
): Promise<{ milestone: Milestone; project: Project; stage: ProjectStage; allMilestones: Milestone[]; invoices: Invoice[] }> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_milestones').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Milestone ${id} not found`)
  }

  if (existing.status === status) {
    throw new DomainError('MILESTONE_TRANSITION_NOT_ALLOWED', `Milestone already has status ${status}`)
  }

  const updates: any = { status, updated_at: now }

  // Transitions:
  // open -> delivered (delivered_at = now)
  // open -> approved and delivered -> approved (approved_at = now, delivered_at ??= now)
  // delivered -> open (clear delivered_at)
  // approved -> delivered (clear approved_at)
  // approved -> open (clear both)
  if (status === 'delivered') {
    updates.delivered_at = now
    updates.approved_at = null
  } else if (status === 'approved') {
    updates.approved_at = now
    updates.delivered_at = existing.delivered_at || now
  } else if (status === 'open') {
    updates.delivered_at = null
    updates.approved_at = null
  }

  await db.updateTable('project_milestones').set(updates).where('id', '=', id).execute()
  await touchProject(existing.project_id, now)

  const [pRow, allMilestonesRows, invoiceRows, stageRows] = await Promise.all([
    db.selectFrom('projects').selectAll().where('id', '=', existing.project_id).executeTakeFirstOrThrow(),
    db.selectFrom('project_milestones').selectAll().where('project_id', '=', existing.project_id).execute(),
    db.selectFrom('invoices').selectAll().where('project_id', '=', existing.project_id).execute(),
    db.selectFrom('project_stages').selectAll().execute(),
  ])

  const stage = stageRows.find((s) => s.id === pRow.stage_id) || stageRows[0]
  const updatedMilestone = allMilestonesRows.find((m) => m.id === id)!

  return {
    milestone: mapMilestoneRow(updatedMilestone),
    project: mapProjectRow(pRow),
    stage: mapProjectStageRow(stage),
    allMilestones: allMilestonesRows.map(mapMilestoneRow),
    invoices: invoiceRows.map(mapInvoiceRow),
  }
}

export async function moveMilestone(
  input: z.infer<typeof moveMilestoneInput>,
  now: string
): Promise<Milestone> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_milestones').selectAll().where('id', '=', input.id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Milestone ${input.id} not found`)
  }

  let beforePos: number | null = null
  let afterPos: number | null = null

  if (input.beforeId) {
    const row = await db.selectFrom('project_milestones').select('position').where('id', '=', input.beforeId).executeTakeFirst()
    if (row) beforePos = row.position
  }
  if (input.afterId) {
    const row = await db.selectFrom('project_milestones').select('position').where('id', '=', input.afterId).executeTakeFirst()
    if (row) afterPos = row.position
  }

  const position = positionBetween(beforePos, afterPos)
  await db.updateTable('project_milestones').set({ position, updated_at: now }).where('id', '=', input.id).execute()
  await touchProject(existing.project_id, now)
  const updated = await db.selectFrom('project_milestones').selectAll().where('id', '=', input.id).executeTakeFirstOrThrow()
  return mapMilestoneRow(updated)
}

export async function deleteMilestone(id: string, now: string): Promise<void> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_milestones').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Milestone ${id} not found`)
  }

  // Invariant I10: Deleting a milestone sets milestone_id = NULL on its tasks and invoices
  await db.transaction().execute(async (trx) => {
    await trx.updateTable('project_tasks').set({ milestone_id: null }).where('milestone_id', '=', id).execute()
    await trx.updateTable('invoices').set({ milestone_id: null }).where('milestone_id', '=', id).execute()
    await trx.deleteFrom('project_milestones').where('id', '=', id).execute()
    await touchProject(existing.project_id, now, trx)
  })
}

// -------------------------------------------------------------
// INVOICES OPERATIONS
// -------------------------------------------------------------

export async function createInvoice(
  input: z.infer<typeof createInvoiceInput>,
  now: string
): Promise<Invoice> {
  await ensureDbInitialized()
  const project = await db.selectFrom('projects').selectAll().where('id', '=', input.projectId).executeTakeFirst()
  if (!project) {
    throw new DomainError('NOT_FOUND', `Project ${input.projectId} not found`)
  }

  if (input.milestoneId) {
    const ms = await db.selectFrom('project_milestones').selectAll().where('id', '=', input.milestoneId).executeTakeFirst()
    if (!ms || ms.project_id !== input.projectId) {
      throw new DomainError('VALIDATION', 'Milestone does not belong to project')
    }
  }

  const settings = await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
  const netDays = settings?.invoice_net_days ?? 14

  let issueDate = input.issueDate
  let dueDate = input.dueDate
  if (input.status === 'sent') {
    issueDate = issueDate || input.today
    dueDate = dueDate || addDays(issueDate, netDays)
  }

  const invId = generateId('inv')
  const newRow = {
    id: invId,
    project_id: input.projectId,
    milestone_id: input.milestoneId,
    number: input.number,
    label: input.label,
    amount_minor: input.amountMinor,
    currency: input.currency || project.currency,
    hours: input.hours,
    status: input.status,
    issue_date: issueDate,
    due_date: dueDate,
    paid_date: null,
    external_url: input.externalUrl,
    notes: input.notes,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('invoices').values(newRow).execute()
  await touchProject(input.projectId, now)
  return mapInvoiceRow(newRow)
}

export async function updateInvoice(
  id: string,
  patch: z.infer<typeof updateInvoiceInput>['patch'],
  now: string
): Promise<Invoice> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('invoices').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Invoice ${id} not found`)
  }

  if (patch.milestoneId !== undefined && patch.milestoneId !== null) {
    const ms = await db.selectFrom('project_milestones').selectAll().where('id', '=', patch.milestoneId).executeTakeFirst()
    if (!ms || ms.project_id !== existing.project_id) {
      throw new DomainError('VALIDATION', 'Milestone does not belong to project')
    }
  }

  const updates: any = { updated_at: now }
  if (patch.label !== undefined) updates.label = patch.label
  if (patch.number !== undefined) updates.number = patch.number
  if (patch.amountMinor !== undefined) updates.amount_minor = patch.amountMinor
  if (patch.currency !== undefined) updates.currency = patch.currency
  if (patch.hours !== undefined) updates.hours = patch.hours
  if (patch.milestoneId !== undefined) updates.milestone_id = patch.milestoneId
  if (patch.issueDate !== undefined) updates.issue_date = patch.issueDate
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate
  if (patch.externalUrl !== undefined) updates.external_url = patch.externalUrl
  if (patch.notes !== undefined) updates.notes = patch.notes

  await db.updateTable('invoices').set(updates).where('id', '=', id).execute()
  await touchProject(existing.project_id, now)
  const updatedRow = await db.selectFrom('invoices').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  return mapInvoiceRow(updatedRow)
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  date: string,
  now: string
): Promise<{ invoice: Invoice; project: Project; stage: ProjectStage; allInvoices: Invoice[] }> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('invoices').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Invoice ${id} not found`)
  }

  const currentStatus = existing.status
  if (currentStatus === status) {
    throw new DomainError('INVOICE_TRANSITION_NOT_ALLOWED', `Invoice already has status ${status}`)
  }

  const allowed: Record<string, string[]> = {
    draft: ['sent', 'paid', 'void'],
    sent: ['draft', 'paid', 'void'],
    paid: ['sent'],
    void: ['draft'],
  }

  if (!allowed[currentStatus]?.includes(status)) {
    throw new DomainError('INVOICE_TRANSITION_NOT_ALLOWED', `Transition from ${currentStatus} to ${status} is not allowed`)
  }

  const settings = await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
  const netDays = settings?.invoice_net_days ?? 14

  const updates: any = { status, updated_at: now }

  if (currentStatus === 'draft' && status === 'sent') {
    updates.issue_date = existing.issue_date || date
    updates.due_date = existing.due_date || addDays(updates.issue_date, netDays)
  } else if (currentStatus === 'draft' && status === 'paid') {
    updates.issue_date = existing.issue_date || date
    updates.paid_date = date
  } else if (currentStatus === 'sent' && status === 'paid') {
    updates.paid_date = date
  } else if (currentStatus === 'paid' && status === 'sent') {
    updates.paid_date = null
  }

  // Invariant I6: paying an invoice NEVER touches projects or deals!
  await db.updateTable('invoices').set(updates).where('id', '=', id).execute()
  await touchProject(existing.project_id, now)

  const [pRow, allInvoicesRows, stageRows] = await Promise.all([
    db.selectFrom('projects').selectAll().where('id', '=', existing.project_id).executeTakeFirstOrThrow(),
    db.selectFrom('invoices').selectAll().where('project_id', '=', existing.project_id).execute(),
    db.selectFrom('project_stages').selectAll().execute(),
  ])

  const stage = stageRows.find((s) => s.id === pRow.stage_id) || stageRows[0]
  const updatedInvoice = allInvoicesRows.find((i) => i.id === id)!

  return {
    invoice: mapInvoiceRow(updatedInvoice),
    project: mapProjectRow(pRow),
    stage: mapProjectStageRow(stage),
    allInvoices: allInvoicesRows.map(mapInvoiceRow),
  }
}

export async function deleteInvoice(id: string, now: string): Promise<Invoice> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('invoices').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Invoice ${id} not found`)
  }

  await db.deleteFrom('invoices').where('id', '=', id).execute()
  await touchProject(existing.project_id, now)
  return mapInvoiceRow(existing)
}

export async function restoreInvoice(invoice: Invoice, now: string): Promise<Invoice> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('invoices').select('id').where('id', '=', invoice.id).executeTakeFirst()
  if (existing) {
    throw new DomainError('VALIDATION', `Invoice ${invoice.id} already exists`)
  }

  const row = {
    id: invoice.id,
    project_id: invoice.projectId,
    milestone_id: invoice.milestoneId,
    number: invoice.number,
    label: invoice.label,
    amount_minor: invoice.amountMinor,
    currency: invoice.currency,
    hours: invoice.hours,
    status: invoice.status,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    paid_date: invoice.paidDate,
    external_url: invoice.externalUrl,
    notes: invoice.notes,
    created_at: invoice.createdAt,
    updated_at: now,
  }

  await db.insertInto('invoices').values(row).execute()
  await touchProject(invoice.projectId, now)
  return mapInvoiceRow(row)
}

// -------------------------------------------------------------
// FEEDBACK & BRIEF SYNC
// -------------------------------------------------------------

export async function logFeedback(
  input: z.infer<typeof logFeedbackInput>,
  now: string
): Promise<{ activity: any; tasks: Task[]; round: number; overScope: boolean }> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', input.projectId).executeTakeFirst()
  if (!pRow) {
    throw new DomainError('NOT_FOUND', `Project ${input.projectId} not found`)
  }

  const existingTasks = await db.selectFrom('project_tasks').selectAll().where('project_id', '=', input.projectId).execute()
  const { round, overScope } = calculateRevisionRound(existingTasks, pRow.revisions_included)

  const actId = generateId('act')
  const activityRow = {
    id: actId,
    deal_id: pRow.deal_id,
    project_id: input.projectId,
    type: input.source as any,
    title: `Feedback round ${round}: ${pRow.title}`,
    person: pRow.contact_name || 'Client',
    company: pRow.company,
    date: input.date,
    status: 'Completed' as const,
    color: 'blue' as const,
    summary: input.text,
    created_at: now,
  }

  // Milestone group min position (to insert tasks at the top)
  const groupTasks = existingTasks.filter(
    (t) => (input.milestoneId ? t.milestone_id === input.milestoneId : !t.milestone_id)
  )
  const minPos = groupTasks.reduce((m, t) => Math.min(m, t.position), POSITION_STEP)

  const createdTasks: any[] = []
  for (let i = 0; i < input.items.length; i++) {
    const itemTitle = input.items[i]
    const pos = (minPos / (input.items.length + 1)) * (i + 1)
    const tId = generateId('tsk')
    createdTasks.push({
      id: tId,
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      title: itemTitle,
      notes: null,
      kind: 'revision' as const,
      revision_round: round,
      source_activity_id: actId,
      due_date: input.dueDate,
      focus_date: null,
      position: pos,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
  }

  await db.transaction().execute(async (trx) => {
    await trx.insertInto('activities').values(activityRow).execute()
    if (createdTasks.length > 0) {
      await trx.insertInto('project_tasks').values(createdTasks).execute()
    }
    await touchProject(input.projectId, now, trx)
  })

  return {
    activity: activityRow,
    tasks: createdTasks.map(mapTaskRow),
    round,
    overScope,
  }
}

export async function syncBrief(
  input: z.infer<typeof syncBriefInput>,
  now: string
): Promise<{ brief: string; created: Task[]; completed: Task[]; reopened: Task[] }> {
  await ensureDbInitialized()
  const pRow = await db.selectFrom('projects').selectAll().where('id', '=', input.projectId).executeTakeFirst()
  if (!pRow) {
    throw new DomainError('NOT_FOUND', `Project ${input.projectId} not found`)
  }

  const tasks = await db
    .selectFrom('project_tasks')
    .selectAll()
    .where('project_id', '=', input.projectId)
    .where('milestone_id', 'is', null)
    .execute()

  const lines = input.brief.replace(/\r\n/g, '\n').split('\n')
  const createdTasks: Task[] = []
  const completedTasks: Task[] = []
  const reopenedTasks: Task[] = []

  // Checkbox line pattern: ^\s*-\s*\[([ xX])\]\s*(.+)$
  const cbRegex = /^\s*-\s*\[([ xX])\]\s*(.+)$/

  for (const line of lines) {
    const match = line.match(cbRegex)
    if (!match) continue

    const isChecked = match[1].toLowerCase() === 'x'
    const title = match[2].trim()
    if (!title) continue

    const matching = tasks.find((t) => t.title.trim() === title)

    if (!isChecked) {
      if (!matching) {
        // Create task
        const newTask = await createTask(
          {
            projectId: input.projectId,
            title,
            milestoneId: null,
            dueDate: null,
            focusDate: null,
            notes: null,
            afterTaskId: null,
          },
          now
        )
        createdTasks.push(newTask)
      } else if (matching.completed_at) {
        // Reopen
        const reopened = await toggleTask(matching.id, false, now)
        reopenedTasks.push(reopened)
      }
    } else {
      if (matching && !matching.completed_at) {
        // Complete
        const completed = await toggleTask(matching.id, true, now)
        completedTasks.push(completed)
      }
    }
  }

  await db.updateTable('projects').set({ brief: input.brief, updated_at: now }).where('id', '=', input.projectId).execute()
  await touchProject(input.projectId, now)

  return {
    brief: input.brief,
    created: createdTasks,
    completed: completedTasks,
    reopened: reopenedTasks,
  }
}

// -------------------------------------------------------------
// TODAY & WEEKLY REVIEW DATA
// -------------------------------------------------------------

export async function getTodayData(today: string): Promise<TodayData> {
  await ensureDbInitialized()
  const [cards, taskRows, invoiceRows, milestoneRows, followUpRows, wonDealRows] = await Promise.all([
    listProjectCards({ includeArchived: false, today }),
    db.selectFrom('project_tasks').selectAll().execute(),
    db.selectFrom('invoices').selectAll().execute(),
    db.selectFrom('project_milestones').selectAll().execute(),
    db.selectFrom('follow_ups').selectAll().execute(),
    db.selectFrom('deals').select(['id', 'title', 'company', 'raw_amount']).where('stage', '=', 'Won').execute(),
  ])

  // Filter won deals without a project
  const projectDealIds = new Set(cards.map((c) => c.project.dealId).filter(Boolean))
  const wonDealsWithoutProject = wonDealRows
    .filter((d) => !projectDealIds.has(d.id))
    .map((d) => ({
      id: d.id,
      title: d.title,
      company: d.company,
      rawAmount: Number(d.raw_amount) || 0,
    }))

  const tasks = taskRows.map(mapTaskRow)
  const invoices = invoiceRows.map(mapInvoiceRow)
  const milestones = milestoneRows.map(mapMilestoneRow)
  const followUps = followUpRows.map((fu) => ({
    id: fu.id,
    day: fu.day as any,
    company: fu.company,
    action: fu.action,
    time: fu.time,
    tone: fu.tone as any,
    completed: Boolean(fu.completed),
  }))

  return buildToday(
    {
      cards,
      tasks,
      invoices,
      milestones,
      followUps,
      wonDealsWithoutProject,
    },
    today
  )
}

export async function getWeeklyReviewData(today: string): Promise<WeeklyReviewData> {
  await ensureDbInitialized()
  const [cards, taskRows, invoiceRows, milestoneRows, settingsRow] = await Promise.all([
    listProjectCards({ includeArchived: false, today }),
    db.selectFrom('project_tasks').selectAll().execute(),
    db.selectFrom('invoices').selectAll().execute(),
    db.selectFrom('project_milestones').selectAll().execute(),
    db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst(),
  ])

  return buildWeeklyReview(
    {
      cards,
      tasks: taskRows.map(mapTaskRow),
      invoices: invoiceRows.map(mapInvoiceRow),
      milestones: milestoneRows.map(mapMilestoneRow),
      lastReviewAt: settingsRow?.last_weekly_review_at ?? null,
    },
    today
  )
}

export async function completeWeeklyReview(
  counts: { projectsReviewed: number; invoicesChased: number; tasksScheduled: number },
  now: string,
  today: string
): Promise<{ lastReviewAt: string }> {
  await ensureDbInitialized()
  await db
    .updateTable('workspace_settings')
    .set({ last_weekly_review_at: now, updated_at: now })
    .where('id', '=', 'current')
    .execute()

  await db.insertInto('activities').values({
    id: generateId('act'),
    deal_id: null,
    project_id: null,
    type: 'Note',
    title: 'Weekly review',
    person: 'Operator',
    company: 'Workspace',
    date: today,
    status: 'Completed',
    color: 'blue',
    summary: `${counts.projectsReviewed} projects reviewed, ${counts.invoicesChased} invoices chased, ${counts.tasksScheduled} tasks scheduled`,
    created_at: now,
  }).execute()

  return { lastReviewAt: now }
}

// -------------------------------------------------------------
// STAGE & TEMPLATE CONFIGURATION
// -------------------------------------------------------------

export async function upsertStage(input: z.infer<typeof stageInput>, now: string): Promise<ProjectStage> {
  await ensureDbInitialized()
  if (input.id) {
    const existing = await db.selectFrom('project_stages').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Stage ${input.id} not found`)
    }
    await db
      .updateTable('project_stages')
      .set({
        name: input.name,
        color: input.color,
        updated_at: now,
      })
      .where('id', '=', input.id)
      .execute()

    const updated = await db.selectFrom('project_stages').selectAll().where('id', '=', input.id).executeTakeFirstOrThrow()
    return mapProjectStageRow(updated)
  }

  const existingInCat = await db
    .selectFrom('project_stages')
    .selectAll()
    .where('category', '=', input.category)
    .orderBy('position', 'desc')
    .executeTakeFirst()

  const position = (existingInCat?.position ?? 0) + 1
  const sId = generateId('stg')
  const newRow = {
    id: sId,
    name: input.name,
    category: input.category,
    position,
    color: input.color,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('project_stages').values(newRow).execute()
  return mapProjectStageRow(newRow)
}

export async function reorderStages(orderedIds: string[], now: string): Promise<ProjectStage[]> {
  await ensureDbInitialized()
  const stages = await db.selectFrom('project_stages').selectAll().execute()

  if (orderedIds.length < 5) {
    throw new DomainError('VALIDATION', 'Must provide all stages')
  }

  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await trx
        .updateTable('project_stages')
        .set({ position: i + 1, updated_at: now })
        .where('id', '=', orderedIds[i])
        .execute()
    }
  })

  const updated = await db.selectFrom('project_stages').selectAll().orderBy('position', 'asc').execute()
  return updated.map(mapProjectStageRow)
}

export async function deleteStage(id: string, moveProjectsToStageId: string | null): Promise<void> {
  await ensureDbInitialized()
  const stage = await db.selectFrom('project_stages').selectAll().where('id', '=', id).executeTakeFirst()
  if (!stage) {
    throw new DomainError('NOT_FOUND', `Stage ${id} not found`)
  }

  // Invariant I7: Every category keeps >= 1 stage
  const categoryStages = await db
    .selectFrom('project_stages')
    .selectAll()
    .where('category', '=', stage.category)
    .execute()

  if (categoryStages.length <= 1) {
    throw new DomainError('LAST_STAGE_IN_CATEGORY', 'Cannot delete the last stage in a category')
  }

  // Check if projects use this stage
  const projectCount = await db
    .selectFrom('projects')
    .select(sql`count(*)`.as('count'))
    .where('stage_id', '=', id)
    .executeTakeFirst()

  const count = Number((projectCount as any)?.count || 0)
  if (count > 0 && !moveProjectsToStageId) {
    throw new DomainError('STAGE_IN_USE', 'Stage is in use by projects and no target stage was provided')
  }

  await db.transaction().execute(async (trx) => {
    if (moveProjectsToStageId) {
      await trx.updateTable('projects').set({ stage_id: moveProjectsToStageId }).where('stage_id', '=', id).execute()
    }
    await trx.deleteFrom('project_stages').where('id', '=', id).execute()
  })
}

export async function upsertTemplate(
  input: z.infer<typeof templateInput>,
  now: string
): Promise<ProjectTemplate> {
  await ensureDbInitialized()
  if (input.id) {
    const existing = await db.selectFrom('project_templates').selectAll().where('id', '=', input.id).executeTakeFirst()
    if (!existing) {
      throw new DomainError('NOT_FOUND', `Template ${input.id} not found`)
    }
    if (existing.is_builtin === 1) {
      throw new DomainError('BUILTIN_TEMPLATE_READONLY', 'Built-in templates are read-only')
    }

    await db
      .updateTable('project_templates')
      .set({
        name: input.name,
        billing_type: input.billingType,
        payment_schedule: input.paymentSchedule,
        duration_days: input.durationDays,
        revisions_included: input.revisionsIncluded,
        milestones_json: JSON.stringify(input.milestones),
        tasks_json: JSON.stringify(input.tasks),
        updated_at: now,
      })
      .where('id', '=', input.id)
      .execute()

    const updated = await db.selectFrom('project_templates').selectAll().where('id', '=', input.id).executeTakeFirstOrThrow()
    return mapTemplateRow(updated)
  }

  const maxTpl = await db.selectFrom('project_templates').select('position').orderBy('position', 'desc').executeTakeFirst()
  const position = (maxTpl?.position ?? 0) + 1

  const tId = generateId('tpl')
  const newRow = {
    id: tId,
    name: input.name,
    billing_type: input.billingType,
    payment_schedule: input.paymentSchedule,
    duration_days: input.durationDays,
    revisions_included: input.revisionsIncluded,
    milestones_json: JSON.stringify(input.milestones),
    tasks_json: JSON.stringify(input.tasks),
    is_builtin: 0,
    position,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('project_templates').values(newRow).execute()
  return mapTemplateRow(newRow)
}

export async function duplicateTemplate(id: string, now: string): Promise<ProjectTemplate> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_templates').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Template ${id} not found`)
  }

  const maxTpl = await db.selectFrom('project_templates').select('position').orderBy('position', 'desc').executeTakeFirst()
  const position = (maxTpl?.position ?? 0) + 1

  const newRow = {
    id: generateId('tpl'),
    name: `${existing.name} (copy)`,
    billing_type: existing.billing_type,
    payment_schedule: existing.payment_schedule,
    duration_days: existing.duration_days,
    revisions_included: existing.revisions_included,
    milestones_json: existing.milestones_json,
    tasks_json: existing.tasks_json,
    is_builtin: 0,
    position,
    created_at: now,
    updated_at: now,
  }

  await db.insertInto('project_templates').values(newRow).execute()
  return mapTemplateRow(newRow)
}

export async function deleteTemplate(id: string): Promise<void> {
  await ensureDbInitialized()
  const existing = await db.selectFrom('project_templates').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Template ${id} not found`)
  }
  if (existing.is_builtin === 1) {
    throw new DomainError('BUILTIN_TEMPLATE_READONLY', 'Built-in templates cannot be deleted')
  }

  await db.deleteFrom('project_templates').where('id', '=', id).execute()
}

export async function updateProjectSettings(
  input: z.infer<typeof projectSettingsInput>,
  now: string
): Promise<{ invoiceNetDays: number }> {
  await ensureDbInitialized()
  await db
    .updateTable('workspace_settings')
    .set({ invoice_net_days: input.invoiceNetDays, updated_at: now })
    .where('id', '=', 'current')
    .execute()

  return { invoiceNetDays: input.invoiceNetDays }
}

