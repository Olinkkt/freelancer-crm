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
