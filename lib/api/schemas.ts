import { z } from 'zod'
import { BOARD_COLUMNS, DEAL_STAGES } from '@/lib/crm-types'
import { ChecklistItemSchema, InvoiceSchema } from '@/lib/validations'
import { API_ERROR_CODES } from './errors'

/**
 * Output and shared schemas for /api/v1 and MCP. Schemas with an `id` become
 * named components in the OpenAPI spec.
 */

export const StageSchema = z.enum(DEAL_STAGES).meta({
  id: 'Stage',
  description:
    'Pipeline stage, in order. CRM side: Lead, Qualified, Proposal. Closed = contract signed (handoff to project work). PM side: Deposit, Materials, Build, Handoff, Revisions, Completed.',
})

export const ColorSchema = z.enum(['blue', 'violet', 'amber', 'green'])

export const BoardColumnSchema = z
  .enum(BOARD_COLUMNS.map((c) => c.id) as [string, ...string[]])
  .describe('Task board column: todo, waiting, blocked, done')

export const TaskSchema = ChecklistItemSchema.meta({
  id: 'Task',
  description:
    'A card on the deal\'s task board or checklist. section "podklady" = client materials (what the client owes you); "deliverables" or missing = your own task. status is kept in step with column (done column = Done).',
})

export const InvoiceOutSchema = InvoiceSchema.meta({ id: 'Invoice', description: 'An invoice milestone on a deal' })

/** ISO date (YYYY-MM-DD). Inputs also accept "today", "tomorrow", "in 3 days", weekday names. */
export const DueDateInput = z
  .string()
  .max(40)
  .describe('Due date. ISO YYYY-MM-DD preferred; "today", "tomorrow", "in 3 days", "friday" also work.')

export const DealSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    value: z.string().describe('Preformatted amount in the workspace currency, e.g. "45 000 Kč"'),
    rawAmount: z.number().describe('Deal amount as a number in the workspace currency'),
    stage: StageSchema,
    next: z.string().describe('Next action (what you do next). Empty when waiting on the client.'),
    nextDueDate: z.string().optional().describe('ISO date the next action is due'),
    waiting: z.boolean().optional().describe('Ball is in the client\'s court; no next action is expected'),
    waitingSince: z.string().optional(),
    color: ColorSchema,
    contactId: z.string().optional().describe('Client (person) id'),
    contactName: z.string(),
    contactEmail: z.string().optional(),
    notes: z.string().optional().describe('Free-form Markdown notes for the deal'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    deliverables: z.array(TaskSchema).optional().describe('Tasks and client materials'),
    invoices: z.array(InvoiceOutSchema).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .meta({ id: 'Deal', description: 'A deal: one piece of work for one client, from lead to completed project' })

export const ClientSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    notes: z.string().optional(),
    deals: z.number(),
    lastTouch: z.string(),
    color: ColorSchema,
  })
  .meta({ id: 'Client', description: 'A client. Clients are people; there are no companies.' })

export const FollowUpSchema = z
  .object({
    id: z.string(),
    day: z.string(),
    company: z.string().describe('Label (client or deal name) the follow-up belongs to'),
    action: z.string(),
    time: z.string(),
    tone: z.string(),
    completed: z.boolean().optional(),
  })
  .meta({ id: 'FollowUp', description: 'A standalone reminder outside a deal\'s next action' })

export const WorkspaceSchema = z
  .object({
    operatorName: z.string(),
    currency: z.string(),
    currencySymbol: z.string(),
    locale: z.string(),
    stages: z.array(
      z.object({ name: StageSchema, side: z.enum(['crm', 'pm']), meaning: z.string() })
    ),
    boardColumns: z.array(z.object({ id: z.string(), label: z.string() })),
    counts: z.object({ deals: z.number(), openDeals: z.number(), activeProjects: z.number(), clients: z.number(), waiting: z.number() }),
  })
  .meta({ id: 'Workspace', description: 'Workspace settings and the pipeline definition' })

const TodayEntrySchema = z.object({
  kind: z.enum(['deal', 'followUp']),
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  tone: z.enum(['overdue', 'today', 'muted']),
  dealId: z.string().optional(),
  dueDate: z.string().optional(),
})

export const TodaySchema = z
  .object({
    date: z.string(),
    due: z.array(TodayEntrySchema).describe('Next actions and follow-ups due today or overdue, most overdue first'),
    waiting: z.array(TodayEntrySchema).describe('Deals waiting on the client (flagged, or missing client materials)'),
    needsYou: z.array(TodayEntrySchema).describe('Deals missing a next action or due date, undated follow-ups'),
    upcoming: z.array(TodayEntrySchema).describe('Next actions due after today, soonest first (max 10)'),
  })
  .meta({ id: 'Today', description: 'What to act on now, same grouping as the Home screen' })

export const ProjectRowSchema = z.object({
  dealId: z.string(),
  title: z.string(),
  client: z.string(),
  stage: StageSchema,
  stageIndex: z.number().describe('Index in the active project stages (Closed … Revisions)'),
  tasksDone: z.number(),
  tasksTotal: z.number(),
  flag: z.enum(['blocked', 'invoice', 'late', 'waiting']).nullable(),
  flagLabel: z.string(),
  due: z.string().nullable(),
  next: z.string(),
  value: z.string(),
})

export const ProjectsSchema = z
  .object({ projects: z.array(ProjectRowSchema) })
  .meta({ id: 'Projects', description: 'Projects being delivered, needs-attention first' })

export const SearchResultSchema = z.object({
  results: z.array(
    z.object({
      type: z.enum(['deal', 'client']),
      id: z.string(),
      title: z.string(),
      subtitle: z.string(),
      score: z.number(),
    })
  ),
})

export const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().describe('Pass as cursor to get the next page; null on the last page'),
  })

export const DeletedSchema = z.object({ id: z.string(), deleted: z.boolean() })

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.enum(API_ERROR_CODES),
      message: z.string(),
      field: z.string().optional(),
      hint: z.string().optional().describe('What to do next to fix the request'),
    }),
  })
  .meta({ id: 'Error' })
