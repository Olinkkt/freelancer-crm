import { z } from 'zod'

export const ContactBackupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deals: z.number().optional(),
  lastTouch: z.string().optional(),
  color: z.string().optional(),
})

export const DealBackupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  value: z.string().default('0'),
  rawAmount: z.number().nonnegative().optional(),
  stage: z.string(),
  next: z.string().default(''),
  nextDueDate: z.string().nullable().optional(),
  color: z.string().optional(),
  contactId: z.string().nullable().optional(),
  contactName: z.string().min(1),
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
    contacts: z.array(ContactBackupSchema).optional(),
    deals: z.array(DealBackupSchema).optional(),
    activities: z.array(ActivityBackupSchema).optional(),
    followUps: z.array(FollowUpBackupSchema).optional(),
    settings: WorkspaceSettingsBackupSchema.optional(),
  })
  .refine(
    (data) => {
      const totalItems =
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
const DealInputBaseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
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
  next: z.string().optional(),
  nextDueDate: z.string().nullable().optional(),
  color: z.string().optional(),
  /** The client (person) this deal belongs to; or pass contactName to match/create one */
  contactId: z.string().nullable().optional(),
  contactName: z.string().trim().max(100, 'Client name cannot exceed 100 characters').nullable().optional(),
  contactEmail: z.string().email().nullable().or(z.literal('')).optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deliverables: z.array(z.any()).optional(),
  invoices: z.array(z.any()).optional(),
})

export const DealCreateInputSchema = DealInputBaseSchema.refine(
  (d) => !!(d.contactId || d.contactName?.trim() || d.contactEmail?.trim()),
  { message: 'Client is required', path: ['contactName'] }
)

export const DealUpdateInputSchema = DealInputBaseSchema.partial().extend({
  id: z.string().min(1, 'Deal ID is required'),
})

export const ContactCreateInputSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(100, 'Name cannot exceed 100 characters'),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  deals: z.number().optional(),
  lastTouch: z.string().optional(),
  color: z.string().optional(),
})
