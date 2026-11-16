import { z } from 'zod'
import { DEAL_STAGES } from '@/lib/crm-types'

const ContactBackupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deals: z.number().optional(),
  lastTouch: z.string().optional(),
  color: z.string().optional(),
})

/** Stage names from older versions, mapped onto the current pipeline */
const LEGACY_STAGES: Record<string, (typeof DEAL_STAGES)[number]> = {
  Paid: 'Closed',
  Won: 'Closed',
  Discovery: 'Qualified',
  Záloha: 'Deposit',
  Podklady: 'Materials',
  Vady: 'Completed',
  Warranty: 'Completed',
}

/** One checklist item on a deal (stored in the deliverables JSON column) */
export const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, 'Item cannot be empty').max(200),
  description: z.string().max(10000).optional(),
  status: z.enum(['Pending', 'In Progress', 'Done']),
  column: z.enum(['todo', 'waiting', 'blocked', 'done']).optional(),
  section: z.enum(['podklady', 'deliverables']).optional(),
  clientSignOff: z.boolean().optional(),
  dueDate: z.string().optional(),
})

export const ChecklistSchema = z.array(ChecklistItemSchema).max(200)

export const DealStageSchema = z.enum(DEAL_STAGES)

/** One invoice milestone on a deal (stored in the invoices JSON column) */
export const InvoiceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['Deposit', 'Progress', 'Final']),
  label: z.string().trim().min(1).max(200),
  amount: z.number().min(0),
  formattedAmount: z.string(),
  percentage: z.number().min(0).max(100),
  status: z.enum(['Draft', 'Sent', 'Paid', 'Overdue']),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
  paymentLink: z.string().optional(),
})

export const DealBackupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  value: z.string().default('0'),
  rawAmount: z.number().nonnegative().optional(),
  stage: z.preprocess((v) => (typeof v === 'string' && LEGACY_STAGES[v]) || v, z.enum(DEAL_STAGES)),
  next: z.string().default(''),
  nextDueDate: z.string().nullable().optional(),
  waiting: z.boolean().optional(),
  waitingSince: z.string().nullable().optional(),
  color: z.string().optional(),
  contactId: z.string().nullable().optional(),
  contactName: z.string().min(1),
  contactEmail: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deliverables: z.array(z.any()).optional(),
  invoices: z.array(z.any()).optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})

const FollowUpBackupSchema = z.object({
  id: z.string().min(1),
  dealId: z.string().nullable().optional(),
  day: z.string().optional(),
  company: z.string(),
  action: z.string(),
  time: z.string(),
  tone: z.string().optional(),
  completed: z.boolean().optional(),
})

const WorkspaceSettingsBackupSchema = z.object({
  operatorName: z.string().optional(),
  operatorEmail: z.string().optional(),
  operatorRole: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  locale: z.string().optional(),
  isClaimed: z.boolean().optional(),
  // No passcodeHash: a backup file must never change who can unlock the workspace
}).optional()

export const BackupPayloadSchema = z
  .object({
    version: z.string().optional(),
    exportedAt: z.string().optional(),
    contacts: z.array(ContactBackupSchema).optional(),
    deals: z.array(DealBackupSchema).optional(),
    followUps: z.array(FollowUpBackupSchema).optional(),
    settings: WorkspaceSettingsBackupSchema.optional(),
  })
  .refine(
    (data) => {
      const totalItems =
        (data.contacts?.length ?? 0) +
        (data.deals?.length ?? 0) +
        (data.followUps?.length ?? 0)
      return totalItems > 0
    },
    {
      message: 'Cannot restore an empty backup. The backup file contains no workspace data.',
      path: ['backup'],
    }
  )

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
  stage: z.enum(DEAL_STAGES),
  next: z.string().optional(),
  nextDueDate: z.string().nullable().optional(),
  waiting: z.boolean().optional(),
  color: z.string().optional(),
  /** The client (person) this deal belongs to; or pass contactName to match/create one */
  contactId: z.string().nullable().optional(),
  contactName: z.string().trim().max(100, 'Client name cannot exceed 100 characters').nullable().optional(),
  contactEmail: z.string().email().nullable().or(z.literal('')).optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  deliverables: ChecklistSchema.optional(),
  invoices: z.array(InvoiceSchema).max(50).optional(),
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

// -------------------------------------------------------------
// Server action inputs
// -------------------------------------------------------------
// Server actions are plain POST endpoints: TypeScript types don't exist at
// runtime, so the shape is checked here. The limits are looser than the API's
// so records saved by older versions can still be edited.

const ColorInput = z.enum(['blue', 'violet', 'amber', 'green']).catch('blue')
const OptionalText = (max: number) => z.string().max(max).nullish().transform((v) => v ?? undefined)

export const IdInput = z.string().min(1).max(200)

export const DealActionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  value: z.string().max(100).catch(''),
  rawAmount: z.number().min(0, 'Deal value cannot be negative').default(0),
  stage: z.enum(DEAL_STAGES),
  next: z.string().max(1000).catch(''),
  nextDueDate: OptionalText(100),
  waiting: z.boolean().optional(),
  color: ColorInput,
  contactId: OptionalText(200),
  contactName: z.string().max(300).catch(''),
  contactEmail: OptionalText(320),
  notes: OptionalText(200000),
  startDate: OptionalText(100),
  endDate: OptionalText(100),
  createdAt: OptionalText(100),
  deliverables: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  invoices: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
})

export const DealUpdateActionSchema = DealActionSchema.extend({ id: IdInput })

export const ContactActionSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(300),
  email: z.string().trim().max(320).catch(''),
  phone: OptionalText(100),
  notes: OptionalText(50000),
  deals: z.number().catch(0),
  lastTouch: z.string().max(100).catch('Today'),
  color: ColorInput,
})

export const ContactUpdateActionSchema = ContactActionSchema.extend({ id: IdInput })

export const FollowUpActionSchema = z.object({
  id: IdInput,
  day: z.string().max(100).catch('Today'),
  company: z.string().max(300),
  action: z.string().trim().min(1, 'Follow-up cannot be empty').max(1000),
  time: z.string().max(100).catch(''),
  tone: z.enum(['urgent', 'normal']).catch('normal'),
  completed: z.boolean().optional(),
})
