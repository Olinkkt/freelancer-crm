import { z } from 'zod'

export const CompanyBackupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().optional(),
  deals: z.number().optional(),
  dealsCount: z.number().optional(),
  value: z.string().optional(),
  pipelineVal: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
})

export const ContactBackupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  company: z.string(),
  companyId: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  deals: z.number().optional(),
  lastTouch: z.string().optional(),
  color: z.string().optional(),
})

export const DealBackupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  companyId: z.string().nullable().optional(),
  value: z.string().default('0'),
  rawAmount: z.number().nonnegative().optional(),
  stage: z.string(),
  probability: z.union([z.string(), z.number()]).optional(),
  next: z.string().default(''),
  nextDueDate: z.string().nullable().optional(),
  color: z.string().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deliverables: z.array(z.any()).optional(),
  invoices: z.array(z.any()).optional(),
})

export const ActivityBackupSchema = z.object({
  id: z.string().min(1),
  dealId: z.string().nullable().optional(),
  type: z.string(),
  title: z.string(),
  person: z.string(),
  company: z.string(),
  date: z.string(),
  status: z.string(),
  color: z.string().optional(),
  summary: z.string().nullable().optional(),
})

export const FollowUpBackupSchema = z.object({
  id: z.string().min(1),
  dealId: z.string().nullable().optional(),
  day: z.string().optional(),
  company: z.string(),
  action: z.string(),
  time: z.string(),
  tone: z.string().optional(),
  completed: z.boolean().optional(),
})

export const WorkspaceSettingsBackupSchema = z.object({
  operatorName: z.string().optional(),
  operatorEmail: z.string().optional(),
  operatorRole: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  locale: z.string().optional(),
  isClaimed: z.boolean().optional(),
  passcodeHash: z.string().optional(),
}).optional()

export const BackupPayloadSchema = z
  .object({
    version: z.string().optional(),
    exportedAt: z.string().optional(),
    companies: z.array(CompanyBackupSchema).optional(),
    contacts: z.array(ContactBackupSchema).optional(),
    deals: z.array(DealBackupSchema).optional(),
    activities: z.array(ActivityBackupSchema).optional(),
    followUps: z.array(FollowUpBackupSchema).optional(),
    settings: WorkspaceSettingsBackupSchema.optional(),
  })
  .refine(
    (data) => {
      const totalItems =
        (data.companies?.length ?? 0) +
        (data.contacts?.length ?? 0) +
        (data.deals?.length ?? 0) +
        (data.activities?.length ?? 0) +
        (data.followUps?.length ?? 0)
      return totalItems > 0
    },
    {
      message: 'Cannot restore an empty backup. The backup file contains no workspace data.',
      path: ['backup'],
    }
  )

export type ValidatedBackupPayload = z.infer<typeof BackupPayloadSchema>

// API Input schemas
export const DealCreateInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  company: z.string().trim().min(1, 'Company is required').max(100, 'Company name cannot exceed 100 characters'),
  companyId: z.string().nullable().optional(),
  value: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        if (typeof val === 'number') return val >= 0
        const trimmed = val.trim()
        if (/-\s*\d+/.test(trimmed)) return false
        const numeric = parseFloat(trimmed.replace(/[^0-9.-]/g, ''))
        return isNaN(numeric) || numeric >= 0
      },
      { message: 'Deal value cannot be negative' }
    )
    .transform((val) => (typeof val === 'number' ? String(val) : val))
    .optional(),
  rawAmount: z.number().min(0, 'Amount cannot be negative').optional(),
  stage: z.enum(['Lead', 'Discovery', 'Proposal', 'Won', 'Paid', 'Lost']),
  probability: z.union([z.string(), z.number()]).optional(),
  next: z.string().optional(),
  nextDueDate: z.string().nullable().optional(),
  color: z.string().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().or(z.literal('')).optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deliverables: z.array(z.any()).optional(),
  invoices: z.array(z.any()).optional(),
})

export const DealUpdateInputSchema = DealCreateInputSchema.partial().extend({
  id: z.string().min(1, 'Deal ID is required'),
})

export const CompanyCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100, 'Company name cannot exceed 100 characters'),
  type: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  deals: z.number().optional(),
  value: z.string().optional(),
  status: z.string().optional(),
  color: z.string().optional(),
})

export const ContactCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(100, 'Name cannot exceed 100 characters'),
  company: z.string().trim().min(1, 'Company is required').max(100, 'Company name cannot exceed 100 characters'),
  companyId: z.string().nullable().optional(),
  role: z.string().max(100).nullable().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(50).nullable().optional(),
  deals: z.number().optional(),
  lastTouch: z.string().optional(),
  color: z.string().optional(),
})
