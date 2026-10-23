import { z } from 'zod'
import {
  STAGE_CATEGORIES,
  BILLING_TYPES,
  MILESTONE_STATUSES,
  TASK_KINDS,
  INVOICE_STATUSES,
  PROJECT_HEALTH,
  CLOSE_OUTCOMES,
  PAYMENT_SCHEDULES,
  FEEDBACK_SOURCES,
  MAX_MINOR,
} from '@/lib/projects/constants'
import { isIsoDate } from '@/lib/projects/dates'

export const id = z.string().min(1).max(100)
export const isoDate = z.string().refine(isIsoDate, 'Expected YYYY-MM-DD')
export const minor = z.number().int().min(0).max(MAX_MINOR)
export const currency = z.string().regex(/^[A-Z]{3}$/)
export const title = z.string().trim().min(1).max(200)
const url = z.string().trim().url().refine((u) => /^https?:\/\//.test(u), 'http(s) only')

export const todayInput = z.object({ today: isoDate })

// Full row schemas used by backup & domain
export const stageSchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  category: z.enum(STAGE_CATEGORIES),
  position: z.number(),
  color: z.string().max(20),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const projectSchema = z.object({
  id,
  title,
  company: z.string().trim().min(1).max(200),
  companyId: id.nullable(),
  dealId: id.nullable(),
  contactName: z.string().trim().max(200).nullable(),
  contactEmail: z.string().trim().email().nullable(),
  stageId: id,
  billingType: z.enum(BILLING_TYPES),
  currency,
  budgetMinor: minor.nullable(),
  hourlyRateMinor: minor.nullable(),
  estimateHours: z.number().min(0).max(10000).nullable(),
  revisionsIncluded: z.number().int().min(0).max(20).nullable(),
  startDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  waitingSinceDate: isoDate.nullable(),
  health: z.enum(PROJECT_HEALTH).nullable(),
  brief: z.string(),
  templateId: id.nullable(),
  closeOutcome: z.enum(CLOSE_OUTCOMES).nullable(),
  closeReason: z.string().nullable(),
  stageChangedAt: z.string(),
  deliveredAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const milestoneSchema = z.object({
  id,
  projectId: id,
  title,
  position: z.number(),
  dueDate: isoDate.nullable(),
  amountMinor: minor.nullable(),
  status: z.enum(MILESTONE_STATUSES),
  deliveredAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const taskSchema = z.object({
  id,
  projectId: id,
  milestoneId: id.nullable(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().nullable(),
  kind: z.enum(TASK_KINDS),
  revisionRound: z.number().int().min(1).nullable(),
  sourceActivityId: id.nullable(),
  dueDate: isoDate.nullable(),
  focusDate: isoDate.nullable(),
  position: z.number(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const invoiceSchema = z.object({
  id,
  projectId: id,
  milestoneId: id.nullable(),
  number: z.string().trim().max(60).nullable(),
  label: title,
  amountMinor: minor,
  currency,
  hours: z.number().min(0).max(10000).nullable(),
  status: z.enum(INVOICE_STATUSES),
  issueDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  paidDate: isoDate.nullable(),
  externalUrl: url.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const templateMilestoneSchema = z.object({
  title,
  offsetDays: z.number().int().min(0).max(3650),
  amountPct: z.number().min(0).max(100).nullable(),
})

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  milestoneIndex: z.number().int().min(0).nullable(),
  offsetDays: z.number().int().min(0).max(3650).nullable(),
})

export const templateSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  billingType: z.enum(BILLING_TYPES),
  paymentSchedule: z.enum(PAYMENT_SCHEDULES),
  durationDays: z.number().int().min(0).max(3650).nullable(),
  revisionsIncluded: z.number().int().min(0).max(20).nullable(),
  milestones: z.array(templateMilestoneSchema).max(30),
  tasks: z.array(templateTaskSchema).max(200),
  isBuiltin: z.boolean(),
  position: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const createProjectInput = z
  .object({
    title,
    company: z.string().trim().min(1).max(200),
    dealId: id.nullable().default(null),
    contactName: z.string().trim().max(200).nullable().default(null),
    contactEmail: z.string().trim().email().nullable().default(null),
    templateId: id.default('tpl-blank'),
    billingType: z.enum(BILLING_TYPES).optional(),
    budgetMinor: minor.nullable().default(null),
    hourlyRateMinor: minor.nullable().default(null),
    estimateHours: z.number().min(0).max(10000).nullable().default(null),
    paymentSchedule: z.enum(PAYMENT_SCHEDULES).optional(),
    startDate: isoDate,
    dueDate: isoDate.nullable().default(null),
    today: isoDate,
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.startDate, {
    path: ['dueDate'],
    message: 'Due date is before start',
  })

export const updateProjectInput = z.object({
  id,
  patch: z
    .object({
      title,
      company: z.string().trim().min(1).max(200),
      contactName: z.string().trim().max(200).nullable(),
      contactEmail: z.string().trim().email().nullable(),
      billingType: z.enum(BILLING_TYPES),
      currency,
      budgetMinor: minor.nullable(),
      hourlyRateMinor: minor.nullable(),
      estimateHours: z.number().min(0).max(10000).nullable(),
      revisionsIncluded: z.number().int().min(0).max(20).nullable(),
      startDate: isoDate.nullable(),
      dueDate: isoDate.nullable(),
      health: z.enum(PROJECT_HEALTH).nullable(),
      brief: z.string().max(100_000),
    })
    .partial()
    .refine((p) => Object.keys(p).length > 0, 'Empty patch'),
})

export const moveProjectStageInput = z.object({ id, stageId: id, today: isoDate })
export const toggleWaitingInput = z.object({ id, today: isoDate })
export const archiveProjectInput = z.object({ id, archived: z.boolean() })
export const closeProjectInput = z
  .object({
    id,
    outcome: z.enum(CLOSE_OUTCOMES),
    reason: z.string().trim().max(1000).nullable().default(null),
    invoiceResolution: z.enum(['none', 'leave_open', 'void_open']),
    markPaidInvoiceIds: z.array(id).max(50).default([]),
    openTasks: z.enum(['keep', 'complete', 'delete']),
    followUps: z.object({
      testimonial: z.boolean(),
      retainer: z.boolean(),
      checkIn: z.boolean(),
    }),
    saveAsTemplateName: z.string().trim().min(1).max(80).nullable().default(null),
    archive: z.boolean(),
    today: isoDate,
  })
  .refine((v) => v.outcome !== 'cancelled' || !!v.reason, {
    path: ['reason'],
    message: 'Reason required',
  })

export const createTaskInput = z.object({
  projectId: id,
  title: z.string().trim().min(1).max(500),
  milestoneId: id.nullable().default(null),
  dueDate: isoDate.nullable().default(null),
  focusDate: isoDate.nullable().default(null),
  notes: z.string().max(20_000).nullable().default(null),
  afterTaskId: id.nullable().default(null),
})

export const updateTaskInput = z.object({
  id,
  patch: z
    .object({
      title: z.string().trim().min(1).max(500),
      notes: z.string().max(20_000).nullable(),
      dueDate: isoDate.nullable(),
      focusDate: isoDate.nullable(),
      milestoneId: id.nullable(),
    })
    .partial()
    .refine((p) => Object.keys(p).length > 0, 'Empty patch'),
})

export const toggleTaskInput = z.object({ id, done: z.boolean() })
export const moveTaskInput = z.object({
  id,
  milestoneId: id.nullable().optional(),
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
})
export const restoreTaskInput = z.object({ task: taskSchema })
export const createMilestoneInput = z.object({
  projectId: id,
  title: title.optional().default(''),
  dueDate: isoDate.nullable().default(null),
  amountMinor: minor.nullable().default(null),
  today: isoDate,
})
export const updateMilestoneInput = z.object({
  id,
  patch: z
    .object({
      title,
      dueDate: isoDate.nullable(),
      amountMinor: minor.nullable(),
    })
    .partial(),
})
export const setMilestoneStatusInput = z.object({ id, status: z.enum(MILESTONE_STATUSES) })
export const moveMilestoneInput = z.object({
  id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
})

export const createInvoiceInput = z.object({
  projectId: id,
  milestoneId: id.nullable().default(null),
  label: title,
  number: z.string().trim().max(60).nullable().default(null),
  amountMinor: minor,
  currency: currency.optional(),
  hours: z.number().min(0).max(10000).nullable().default(null),
  status: z.enum(['draft', 'sent']).default('draft'),
  issueDate: isoDate.nullable().default(null),
  dueDate: isoDate.nullable().default(null),
  externalUrl: url.nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  today: isoDate,
})
export const updateInvoiceInput = z.object({
  id,
  patch: createInvoiceInput.omit({ projectId: true, status: true, today: true }).partial(),
})
export const setInvoiceStatusInput = z.object({
  id,
  status: z.enum(INVOICE_STATUSES),
  date: isoDate.optional(),
  today: isoDate,
})

export const logFeedbackInput = z.object({
  projectId: id,
  source: z.enum(FEEDBACK_SOURCES),
  date: isoDate,
  milestoneId: id.nullable(),
  text: z.string().trim().min(1).max(50_000),
  items: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
  dueDate: isoDate.nullable(),
})
export const syncBriefInput = z.object({ projectId: id, brief: z.string().max(100_000) })

export const stageInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(40),
  category: z.enum(STAGE_CATEGORIES),
  color: z.string().max(20),
})
export const reorderStagesInput = z.object({ orderedIds: z.array(id).min(5) })
export const deleteStageInput = z.object({ id, moveProjectsToStageId: id.nullable() })
export const templateInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(80),
  billingType: z.enum(BILLING_TYPES),
  paymentSchedule: z.enum(PAYMENT_SCHEDULES),
  durationDays: z.number().int().min(0).max(3650).nullable(),
  revisionsIncluded: z.number().int().min(0).max(20).nullable(),
  milestones: z.array(templateMilestoneSchema).max(30),
  tasks: z.array(templateTaskSchema).max(200),
})
export const shortcutOverridesInput = z.object({
  overrides: z.record(z.string(), z.array(z.string().min(1).max(40)).min(1).max(2)),
})
export const projectSettingsInput = z.object({
  invoiceNetDays: z.number().int().min(0).max(120),
})

