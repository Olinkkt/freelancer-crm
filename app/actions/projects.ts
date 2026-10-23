'use server'

import { z } from 'zod'
import { runAction, type ActionResult } from '@/lib/projects/action-result'
import * as pRepo from '@/lib/db/projects-repository'
import {
  suggestOnMilestoneDelivered,
  suggestOnMilestoneApproved,
  suggestOnInvoicePaid,
  suggestOnFeedbackLogged,
} from '@/lib/projects/suggestions'
import {
  id,
  isoDate,
  todayInput,
  createProjectInput,
  updateProjectInput,
  moveProjectStageInput,
  toggleWaitingInput,
  archiveProjectInput,
  closeProjectInput,
  createTaskInput,
  updateTaskInput,
  toggleTaskInput,
  moveTaskInput,
  restoreTaskInput,
  createMilestoneInput,
  updateMilestoneInput,
  setMilestoneStatusInput,
  moveMilestoneInput,
  createInvoiceInput,
  updateInvoiceInput,
  setInvoiceStatusInput,
  logFeedbackInput,
  syncBriefInput,
  stageInput,
  reorderStagesInput,
  deleteStageInput,
  templateInput,
  projectSettingsInput,
  invoiceSchema,
} from '@/lib/validations/projects'
import type {
  Project,
  ProjectStage,
  Milestone,
  Task,
  Invoice,
  ProjectTemplate,
  ProjectCard,
  ProjectDetail,
  TodayData,
} from '@/lib/projects/types'
import type { WeeklyReviewData } from '@/lib/projects/review'

export async function fetchProjectsAction(input: {
  includeArchived: boolean
  today: string
}): Promise<ActionResult<ProjectCard[]>> {
  const schema = z.object({ includeArchived: z.boolean(), today: isoDate })
  return runAction(
    schema,
    input,
    async (data) => {
      const cards = await pRepo.listProjectCards(data)
      return { data: cards }
    },
    'Failed to fetch projects'
  )
}

export async function fetchProjectAction(input: {
  id: string
  today: string
}): Promise<ActionResult<ProjectDetail>> {
  const schema = z.object({ id, today: isoDate })
  return runAction(
    schema,
    input,
    async (data) => {
      const detail = await pRepo.getProjectDetail(data.id, data.today)
      if (!detail) {
        const err: any = new Error(`Project ${data.id} not found`)
        err.code = 'NOT_FOUND'
        throw err
      }
      return { data: detail }
    },
    'Failed to fetch project detail'
  )
}

export async function fetchTodayAction(
  input: z.input<typeof todayInput>
): Promise<ActionResult<TodayData>> {
  return runAction(
    todayInput,
    input,
    async (data) => {
      const todayData = await pRepo.getTodayData(data.today)
      return { data: todayData }
    },
    'Failed to fetch today data'
  )
}

export async function createProjectAction(
  input: z.input<typeof createProjectInput>
): Promise<ActionResult<ProjectDetail>> {
  return runAction(
    createProjectInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const detail = await pRepo.createProject(data, now)
      return { data: detail }
    },
    'Failed to create project'
  )
}

export async function updateProjectAction(
  input: z.input<typeof updateProjectInput>
): Promise<ActionResult<Project>> {
  return runAction(
    updateProjectInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const project = await pRepo.updateProject(data.id, data.patch, now)
      return { data: project }
    },
    'Failed to update project'
  )
}

export async function moveProjectStageAction(
  input: z.input<typeof moveProjectStageInput>
): Promise<ActionResult<Project>> {
  return runAction(
    moveProjectStageInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.moveProjectStage(data.id, data.stageId, data.today, now)
      return { data: res.project }
    },
    'Failed to move project stage'
  )
}

export async function toggleProjectWaitingAction(
  input: z.input<typeof toggleWaitingInput>
): Promise<ActionResult<Project>> {
  return runAction(
    toggleWaitingInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const project = await pRepo.toggleProjectWaiting(data.id, data.today, now)
      return { data: project }
    },
    'Failed to toggle project waiting'
  )
}

export async function closeProjectAction(
  input: z.input<typeof closeProjectInput>
): Promise<ActionResult<Project>> {
  return runAction(
    closeProjectInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const project = await pRepo.closeProject(data, now)
      return { data: project }
    },
    'Failed to close project'
  )
}

export async function reopenProjectAction(input: {
  id: string
}): Promise<ActionResult<Project>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const project = await pRepo.reopenProject(data.id, now)
      return { data: project }
    },
    'Failed to reopen project'
  )
}

export async function archiveProjectAction(
  input: z.input<typeof archiveProjectInput>
): Promise<ActionResult<Project>> {
  return runAction(
    archiveProjectInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const project = await pRepo.archiveProject(data.id, data.archived, now)
      return { data: project }
    },
    'Failed to update archive status'
  )
}

export async function deleteProjectAction(input: {
  id: string
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      await pRepo.deleteProject(data.id)
      return { data: { id: data.id } }
    },
    'Failed to delete project'
  )
}

// -------------------------------------------------------------
// TASK ACTIONS
// -------------------------------------------------------------

export async function createTaskAction(
  input: z.input<typeof createTaskInput>
): Promise<ActionResult<Task>> {
  return runAction(
    createTaskInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.createTask(data, now)
      return { data: task }
    },
    'Failed to create task'
  )
}

export async function updateTaskAction(
  input: z.input<typeof updateTaskInput>
): Promise<ActionResult<Task>> {
  return runAction(
    updateTaskInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.updateTask(data.id, data.patch, now)
      return { data: task }
    },
    'Failed to update task'
  )
}

export async function toggleTaskAction(
  input: z.input<typeof toggleTaskInput>
): Promise<ActionResult<Task>> {
  return runAction(
    toggleTaskInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.toggleTask(data.id, data.done, now)
      return { data: task }
    },
    'Failed to toggle task'
  )
}

export async function moveTaskAction(
  input: z.input<typeof moveTaskInput>
): Promise<ActionResult<Task>> {
  return runAction(
    moveTaskInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.moveTask(data, now)
      return { data: task }
    },
    'Failed to move task'
  )
}

export async function deleteTaskAction(input: {
  id: string
}): Promise<ActionResult<Task>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.deleteTask(data.id, now)
      return { data: task }
    },
    'Failed to delete task'
  )
}

export async function restoreTaskAction(
  input: z.input<typeof restoreTaskInput>
): Promise<ActionResult<Task>> {
  return runAction(
    restoreTaskInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const task = await pRepo.restoreTask(data.task, now)
      return { data: task }
    },
    'Failed to restore task'
  )
}

// -------------------------------------------------------------
// MILESTONE ACTIONS
// -------------------------------------------------------------

export async function createMilestoneAction(
  input: z.input<typeof createMilestoneInput>
): Promise<ActionResult<Milestone>> {
  return runAction(
    createMilestoneInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.createMilestone(data, now)
      return { data: res.milestone }
    },
    'Failed to create milestone'
  )
}

export async function updateMilestoneAction(
  input: z.input<typeof updateMilestoneInput>
): Promise<ActionResult<Milestone>> {
  return runAction(
    updateMilestoneInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const ms = await pRepo.updateMilestone(data.id, data.patch, now)
      return { data: ms }
    },
    'Failed to update milestone'
  )
}

export async function setMilestoneStatusAction(
  input: z.input<typeof setMilestoneStatusInput>
): Promise<ActionResult<Milestone>> {
  return runAction(
    setMilestoneStatusInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.setMilestoneStatus(data.id, data.status, now)
      let suggestion = null
      if (data.status === 'delivered') {
        suggestion = suggestOnMilestoneDelivered(res.project, res.stage)
      } else if (data.status === 'approved') {
        suggestion = suggestOnMilestoneApproved(
          res.project,
          res.stage,
          res.milestone,
          res.allMilestones,
          res.invoices
        )
      }
      return {
        data: res.milestone,
        suggestions: suggestion ? [suggestion] : [],
      }
    },
    'Failed to update milestone status'
  )
}

export async function moveMilestoneAction(
  input: z.input<typeof moveMilestoneInput>
): Promise<ActionResult<Milestone>> {
  return runAction(
    moveMilestoneInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const ms = await pRepo.moveMilestone(data, now)
      return { data: ms }
    },
    'Failed to move milestone'
  )
}

export async function deleteMilestoneAction(input: {
  id: string
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      await pRepo.deleteMilestone(data.id, now)
      return { data: { id: data.id } }
    },
    'Failed to delete milestone'
  )
}

// -------------------------------------------------------------
// INVOICE ACTIONS
// -------------------------------------------------------------

export async function createInvoiceAction(
  input: z.input<typeof createInvoiceInput>
): Promise<ActionResult<Invoice>> {
  return runAction(
    createInvoiceInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const inv = await pRepo.createInvoice(data, now)
      return { data: inv }
    },
    'Failed to create invoice'
  )
}

export async function updateInvoiceAction(
  input: z.input<typeof updateInvoiceInput>
): Promise<ActionResult<Invoice>> {
  return runAction(
    updateInvoiceInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const inv = await pRepo.updateInvoice(data.id, data.patch, now)
      return { data: inv }
    },
    'Failed to update invoice'
  )
}

export async function setInvoiceStatusAction(
  input: z.input<typeof setInvoiceStatusInput>
): Promise<ActionResult<Invoice>> {
  return runAction(
    setInvoiceStatusInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const date = data.date || data.today
      const res = await pRepo.setInvoiceStatus(data.id, data.status, date, now)
      let suggestion = null
      if (data.status === 'paid') {
        suggestion = suggestOnInvoicePaid(res.project, res.stage, res.allInvoices)
      }
      return {
        data: res.invoice,
        suggestions: suggestion ? [suggestion] : [],
      }
    },
    'Failed to set invoice status'
  )
}

export async function deleteInvoiceAction(input: {
  id: string
}): Promise<ActionResult<Invoice>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const inv = await pRepo.deleteInvoice(data.id, now)
      return { data: inv }
    },
    'Failed to delete invoice'
  )
}

export async function restoreInvoiceAction(input: {
  invoice: z.infer<typeof invoiceSchema>
}): Promise<ActionResult<Invoice>> {
  const schema = z.object({ invoice: invoiceSchema })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const inv = await pRepo.restoreInvoice(data.invoice, now)
      return { data: inv }
    },
    'Failed to restore invoice'
  )
}

// -------------------------------------------------------------
// FEEDBACK & BRIEF ACTIONS
// -------------------------------------------------------------

export async function logFeedbackAction(
  input: z.input<typeof logFeedbackInput>
): Promise<ActionResult<{ activity: any; tasks: Task[]; round: number; overScope: boolean }>> {
  return runAction(
    logFeedbackInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.logFeedback(data, now)
      const detail = await pRepo.getProjectDetail(data.projectId, data.date)
      const currentStage = detail ? detail.stages.find((s) => s.id === detail.project.stageId) : null
      const suggestion = detail && currentStage
        ? suggestOnFeedbackLogged(detail.project, currentStage)
        : null
      return {
        data: res,
        suggestions: suggestion ? [suggestion] : [],
      }
    },
    'Failed to log feedback'
  )
}

export async function syncBriefAction(
  input: z.input<typeof syncBriefInput>
): Promise<ActionResult<{ brief: string; created: Task[]; completed: Task[]; reopened: Task[] }>> {
  return runAction(
    syncBriefInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.syncBrief(data, now)
      return { data: res }
    },
    'Failed to sync brief'
  )
}

// -------------------------------------------------------------
// REVIEW ACTIONS
// -------------------------------------------------------------

export async function fetchWeeklyReviewAction(
  input: z.input<typeof todayInput>
): Promise<ActionResult<WeeklyReviewData>> {
  return runAction(
    todayInput,
    input,
    async (data) => {
      const reviewData = await pRepo.getWeeklyReviewData(data.today)
      return { data: reviewData }
    },
    'Failed to fetch weekly review'
  )
}

export async function completeWeeklyReviewAction(input: {
  projectsReviewed: number
  invoicesChased: number
  tasksScheduled: number
}): Promise<ActionResult<{ lastReviewAt: string }>> {
  const schema = z.object({
    projectsReviewed: z.number().int().min(0),
    invoicesChased: z.number().int().min(0),
    tasksScheduled: z.number().int().min(0),
  })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const res = await pRepo.completeWeeklyReview(data, now, today)
      return { data: res }
    },
    'Failed to complete weekly review'
  )
}

// -------------------------------------------------------------
// STAGE & TEMPLATE CONFIG ACTIONS
// -------------------------------------------------------------

export async function fetchProjectConfigAction(
  input: {} = {}
): Promise<ActionResult<{ stages: ProjectStage[]; templates: ProjectTemplate[]; invoiceNetDays: number }>> {
  const schema = z.object({}).default({})
  return runAction(
    schema,
    input,
    async () => {
      const config = await pRepo.getProjectConfig()
      const settings = await pRepo.getWorkspaceSettings()
      return {
        data: {
          stages: config.stages,
          templates: config.templates,
          invoiceNetDays: settings?.invoice_net_days ?? 14,
        },
      }
    },
    'Failed to fetch project configuration'
  )
}

export async function upsertStageAction(
  input: z.input<typeof stageInput>
): Promise<ActionResult<ProjectStage>> {
  return runAction(
    stageInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const stage = await pRepo.upsertStage(data, now)
      return { data: stage }
    },
    'Failed to save stage'
  )
}

export async function reorderStagesAction(
  input: z.input<typeof reorderStagesInput>
): Promise<ActionResult<ProjectStage[]>> {
  return runAction(
    reorderStagesInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const stages = await pRepo.reorderStages(data.orderedIds, now)
      return { data: stages }
    },
    'Failed to reorder stages'
  )
}

export async function deleteStageAction(
  input: z.input<typeof deleteStageInput>
): Promise<ActionResult<{ id: string }>> {
  return runAction(
    deleteStageInput,
    input,
    async (data) => {
      await pRepo.deleteStage(data.id, data.moveProjectsToStageId)
      return { data: { id: data.id } }
    },
    'Failed to delete stage'
  )
}

export async function upsertTemplateAction(
  input: z.input<typeof templateInput>
): Promise<ActionResult<ProjectTemplate>> {
  return runAction(
    templateInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const tpl = await pRepo.upsertTemplate(data, now)
      return { data: tpl }
    },
    'Failed to save template'
  )
}

export async function duplicateTemplateAction(input: {
  id: string
}): Promise<ActionResult<ProjectTemplate>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const tpl = await pRepo.duplicateTemplate(data.id, now)
      return { data: tpl }
    },
    'Failed to duplicate template'
  )
}

export async function deleteTemplateAction(input: {
  id: string
}): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({ id })
  return runAction(
    schema,
    input,
    async (data) => {
      await pRepo.deleteTemplate(data.id)
      return { data: { id: data.id } }
    },
    'Failed to delete template'
  )
}

export async function updateProjectSettingsAction(
  input: z.input<typeof projectSettingsInput>
): Promise<ActionResult<{ invoiceNetDays: number }>> {
  return runAction(
    projectSettingsInput,
    input,
    async (data) => {
      const now = new Date().toISOString()
      const res = await pRepo.updateProjectSettings(data, now)
      return { data: res }
    },
    'Failed to update project settings'
  )
}
