import crypto from 'crypto'
import { z } from 'zod'
import * as repo from '@/lib/db/repository'
import {
  ACTIVE_PROJECT_STAGES,
  BOARD_COLUMNS,
  DEAL_STAGES,
  DEAL_STAGE_HINTS,
  OPEN_DEAL_STAGES,
  isPmStage,
  nextDealStage,
  type Contact,
  type Deal,
  type DeliverableItem,
  type InvoiceMilestone,
} from '@/lib/crm-types'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'
import { normalizeDueDate } from '@/lib/due-date'
import { fuzzyScoreFields } from '@/lib/fuzzy'
import { buildToday, buildUpcoming, type TodayItem } from '@/lib/home/today'
import { buildProjects } from '@/lib/home/projects'
import { ApiError, notFound } from './errors'
import { defineOperation, type Operation, type OperationContext } from './registry'
import {
  BoardColumnSchema,
  ClientSchema,
  ColorSchema,
  DealSchema,
  DeletedSchema,
  DueDateInput,
  FollowUpSchema,
  InvoiceOutSchema,
  ProjectsSchema,
  SearchResultSchema,
  StageSchema,
  TaskSchema,
  TodaySchema,
  WorkspaceSchema,
  page,
} from './schemas'
import { queueContactSync } from '@/lib/invoicer/sync'

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

const newId = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

async function moneySettings() {
  return (await repo.getWorkspaceSettings()) ?? OPERATOR_CONFIG
}

function parseDue(input: string | undefined | null, field = 'nextDueDate'): string | undefined {
  if (input === undefined || input === null || input === '') return undefined
  const iso = normalizeDueDate(input)
  if (!iso) {
    throw new ApiError('validation_failed', `Could not understand the date "${input}"`, {
      field,
      hint: 'Use an ISO date like 2026-11-20, or "today", "tomorrow", "in 3 days", "friday".',
    })
  }
  return iso
}

/** GTD rule: every deal has a next action with a due date, or is waiting on the client */
function assertNextActionRule(deal: Deal) {
  if (deal.stage === 'Completed' || deal.waiting) return
  if (!deal.next?.trim()) {
    throw new ApiError('validation_failed', 'Every deal needs a next action', {
      field: 'next',
      hint: 'Pass next (what you do next) and nextDueDate, or set waiting: true if the client owes you something.',
    })
  }
  if (!deal.nextDueDate) {
    throw new ApiError('validation_failed', `The next action "${deal.next}" needs a due date`, {
      field: 'nextDueDate',
      hint: 'Pass nextDueDate, e.g. "2026-11-20" or "tomorrow".',
    })
  }
}

/** Writes need the exact id; reads also accept a title or slug */
async function loadDeal(id: string, exact: boolean): Promise<Deal> {
  const deal = await repo.getDealById(id)
  if (!deal || (exact && deal.id !== id)) {
    throw notFound('Deal', id, 'Call search or list_deals to find the deal id. Writes need the exact id.')
  }
  return deal
}

async function loadClient(id: string): Promise<Contact> {
  const { contacts } = await repo.getWorkspaceData()
  const client = contacts.find((c) => c.id === id)
  if (!client) throw notFound('Client', id, 'Call search or list_clients to find the client id.')
  return client
}

/**
 * Load a deal, apply a change, enforce the rules, then save (unless dry run)
 * and record before/after for the audit log.
 */
async function mutateDeal(
  ctx: OperationContext,
  id: string,
  change: (deal: Deal) => Deal | Promise<Deal>,
  opts: { checkNextAction?: boolean } = {}
): Promise<Deal> {
  const before = await loadDeal(id, true)
  const next = await change(clone(before))
  if (opts.checkNextAction) assertNextActionRule(next)
  if (ctx.dryRun) {
    ctx.record({ entityType: 'deal', entityId: id, before, after: next })
    return next
  }

  const saved = await repo.updateDeal(next)
  if (!saved) throw notFound('Deal', id)
  const after = (await repo.getDealById(id)) ?? saved
  ctx.record({ entityType: 'deal', entityId: id, before, after })
  return after
}

function taskStatusFor(column: string): DeliverableItem['status'] {
  return column === 'done' ? 'Done' : 'Pending'
}

function findTask(deal: Deal, taskId: string): DeliverableItem {
  const task = (deal.deliverables ?? []).find((t) => t.id === taskId)
  if (!task) throw notFound('Task', taskId, 'Call get_deal to see the deal\'s tasks and their ids.')
  return task
}

function findInvoice(deal: Deal, invoiceId: string): InvoiceMilestone {
  const inv = (deal.invoices ?? []).find((i) => i.id === invoiceId)
  if (!inv) throw notFound('Invoice', invoiceId, 'Call get_deal to see the deal\'s invoices and their ids.')
  return inv
}

const encodeCursor = (offset: number) => Buffer.from(JSON.stringify({ o: offset })).toString('base64url')
function decodeCursor(cursor?: string): number {
  if (!cursor) return 0
  try {
    const { o } = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (Number.isInteger(o) && o >= 0) return o
  } catch {}
  throw new ApiError('validation_failed', 'Invalid cursor', { field: 'cursor', hint: 'Pass nextCursor from the previous page unchanged.' })
}

function paginate<T>(items: T[], limit: number, cursor?: string) {
  const offset = decodeCursor(cursor)
  const slice = items.slice(offset, offset + limit)
  return { items: slice, nextCursor: offset + limit < items.length ? encodeCursor(offset + limit) : null }
}

const Limit = (def: number, max: number) => z.number().int().min(1).max(max).optional().default(def).describe(`Page size (default ${def}, max ${max})`)
const Cursor = z.string().optional().describe('Opaque cursor from the previous page')

const DealId = z.string().min(1).describe('Deal id (from search, list_deals or get_today)')
const DealIdOrName = z.string().min(1).describe('Deal id; title or slug also works')

function todayEntry(item: TodayItem) {
  if (item.kind === 'deal') {
    return {
      kind: 'deal' as const,
      id: item.deal.id,
      title: item.title,
      detail: item.detail,
      tone: item.tone,
      dealId: item.deal.id,
      dueDate: item.deal.nextDueDate,
    }
  }
  return {
    kind: 'followUp' as const,
    id: item.followUp.id,
    title: item.title,
    detail: item.detail,
    tone: item.tone,
    dueDate: normalizeDueDate(item.followUp.time) ?? undefined,
  }
}

// -------------------------------------------------------------
// Read operations
// -------------------------------------------------------------

const getWorkspace = defineOperation({
  name: 'get_workspace',
  title: 'Get workspace',
  description:
    'Workspace currency, locale, the pipeline stages with their meaning, task board columns and headline counts. Call once at the start of a session to learn the vocabulary.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/workspace' },
  input: z.object({}),
  output: WorkspaceSchema,
  async handler() {
    const { deals, contacts, settings } = await repo.getWorkspaceData()
    const s = settings ?? { ...OPERATOR_CONFIG, operatorName: OPERATOR_CONFIG.name }
    return {
      operatorName: settings?.operatorName ?? OPERATOR_CONFIG.name,
      currency: s.currency,
      currencySymbol: s.currencySymbol,
      locale: s.locale,
      stages: DEAL_STAGES.map((name) => ({
        name,
        side: OPEN_DEAL_STAGES.includes(name) ? ('crm' as const) : ('pm' as const),
        meaning: DEAL_STAGE_HINTS[name],
      })),
      boardColumns: BOARD_COLUMNS.map((c) => ({ id: c.id, label: c.label })),
      counts: {
        deals: deals.length,
        openDeals: deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage)).length,
        activeProjects: deals.filter((d) => ACTIVE_PROJECT_STAGES.includes(d.stage)).length,
        clients: contacts.length,
        waiting: deals.filter((d) => d.waiting).length,
      },
    }
  },
})

const getToday = defineOperation({
  name: 'get_today',
  title: 'What to do today',
  description:
    'The operator\'s action list, same as the Home screen: due (next actions and follow-ups due today or overdue), waiting (on the client), needsYou (deals missing a next action or date), and upcoming. Start here for "what should I do", daily reviews and triage.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/today' },
  input: z.object({}),
  output: TodaySchema,
  async handler() {
    const { deals, followUps } = await repo.getWorkspaceData()
    const now = new Date()
    const completed = followUps.filter((f) => f.completed).map((f) => f.id)
    const groups = buildToday(deals, followUps, completed, now)
    const upcoming = buildUpcoming(deals, now).slice(0, 10)
    return {
      date: normalizeDueDate('today', now)!,
      due: groups.due.map(todayEntry),
      waiting: groups.waiting.map(todayEntry),
      needsYou: groups.needsYou.map(todayEntry),
      upcoming: upcoming.map((d) => ({
        kind: 'deal' as const,
        id: d.id,
        title: d.next,
        detail: `${d.title} · ${d.stage}`,
        tone: 'muted' as const,
        dealId: d.id,
        dueDate: d.nextDueDate,
      })),
    }
  },
})

const getProjectsOverview = defineOperation({
  name: 'get_projects_overview',
  title: 'Projects overview',
  description:
    'Projects being delivered (stages Closed to Revisions), needs-attention first: blocked tasks, overdue invoices, late, then on track, waiting on client last. Use for status reports and weekly reviews. Not for leads; use list_deals for those.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/projects' },
  input: z.object({}),
  output: ProjectsSchema,
  async handler() {
    const { deals } = await repo.getWorkspaceData()
    return {
      projects: buildProjects(deals).map((r) => ({
        dealId: r.deal.id,
        title: r.deal.title,
        client: r.deal.contactName,
        stage: r.deal.stage,
        stageIndex: r.stageIndex,
        tasksDone: r.tasksDone,
        tasksTotal: r.tasksTotal,
        flag: r.flag,
        flagLabel: r.flagLabel,
        due: r.due,
        next: r.deal.waiting ? '' : r.deal.next,
        value: r.deal.value,
      })),
    }
  },
})

const search = defineOperation({
  name: 'search',
  title: 'Search deals and clients',
  description:
    'Fuzzy search across deal titles, client names, emails and next actions. Use it to resolve a name the user mentions ("the Novák website") to an id before any write. If several results fit, ask the user which one.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/search' },
  input: z.object({
    q: z.string().trim().min(1).max(200).describe('Search text'),
    limit: Limit(10, 50),
  }),
  output: SearchResultSchema,
  example: { q: 'novak web' },
  async handler({ q, limit }) {
    const { deals, contacts } = await repo.getWorkspaceData()
    const results = [
      ...deals.map((d) => ({
        type: 'deal' as const,
        id: d.id,
        title: d.title,
        subtitle: `${d.contactName} · ${d.stage}${d.waiting ? ' · waiting' : d.next ? ` · next: ${d.next}` : ''}`,
        score: fuzzyScoreFields(q, [d.title, d.contactName, d.next, d.contactEmail], [1.2, 1, 0.6, 0.6]),
      })),
      ...contacts.map((c) => ({
        type: 'client' as const,
        id: c.id,
        title: c.name,
        subtitle: [c.email, `${c.deals} deal${c.deals === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
        score: fuzzyScoreFields(q, [c.name, c.email], [1.1, 0.8]),
      })),
    ]
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    return { results }
  },
})

const listDeals = defineOperation({
  name: 'list_deals',
  title: 'List deals',
  description:
    'Deals, newest first, with optional filters. Filter by stage (one or several), waiting, client, or updatedSince to sync changes. For "what is due" use get_today instead.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/deals' },
  input: z.object({
    stage: z.array(StageSchema).optional().describe('Only these stages (REST: comma-separated)'),
    side: z.enum(['crm', 'pm']).optional().describe('crm = Lead/Qualified/Proposal, pm = Closed and after'),
    waiting: z.boolean().optional(),
    contactId: z.string().optional().describe('Only deals of this client'),
    updatedSince: z.string().optional().describe('ISO timestamp; only deals changed after it'),
    limit: Limit(50, 200),
    cursor: Cursor,
  }),
  output: page(DealSchema),
  async handler(input) {
    let { deals } = await repo.getWorkspaceData()
    if (input.stage?.length) deals = deals.filter((d) => input.stage!.includes(d.stage))
    if (input.side) deals = deals.filter((d) => (input.side === 'pm') === isPmStage(d.stage))
    if (input.waiting !== undefined) deals = deals.filter((d) => !!d.waiting === input.waiting)
    if (input.contactId) deals = deals.filter((d) => d.contactId === input.contactId)
    if (input.updatedSince) {
      const since = input.updatedSince
      deals = deals.filter((d) => (d.updatedAt ?? d.createdAt ?? '') > since)
    }
    return paginate(deals, input.limit, input.cursor)
  },
})

const getDeal = defineOperation({
  name: 'get_deal',
  title: 'Get a deal',
  description: 'One deal with everything on it: next action, notes, tasks and client materials (deliverables), invoices.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/deals/{id}' },
  input: z.object({ id: DealIdOrName }),
  output: DealSchema,
  async handler({ id }) {
    return loadDeal(id, false)
  },
})

const listClients = defineOperation({
  name: 'list_clients',
  title: 'List clients',
  description: 'Clients (people) alphabetically, optionally filtered by a search term. Clients are people; there are no companies.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/clients' },
  input: z.object({
    q: z.string().trim().max(200).optional().describe('Filter by name or email'),
    limit: Limit(50, 200),
    cursor: Cursor,
  }),
  output: page(ClientSchema),
  async handler({ q, limit, cursor }) {
    let { contacts } = await repo.getWorkspaceData()
    if (q) contacts = contacts.filter((c) => fuzzyScoreFields(q, [c.name, c.email], [1, 1]) >= 0)
    return paginate(contacts, limit, cursor)
  },
})

const getClient = defineOperation({
  name: 'get_client',
  title: 'Get a client',
  description: 'One client with all their deals. Use it to see a client\'s full history before writing to them or creating another deal.',
  scope: 'read',
  idempotent: true,
  http: { method: 'GET', path: '/clients/{id}' },
  input: z.object({ id: z.string().min(1).describe('Client id') }),
  output: z.object({ client: ClientSchema, deals: z.array(DealSchema) }),
  async handler({ id }) {
    const { contacts, deals } = await repo.getWorkspaceData()
    const client = contacts.find((c) => c.id === id)
    if (!client) throw notFound('Client', id)
    return { client, deals: deals.filter((d) => d.contactId === id) }
  },
})

const listFollowUps = defineOperation({
  name: 'list_follow_ups',
  title: 'List follow-ups',
  description: 'Standalone follow-up reminders. Most work lives in deal next actions; prefer get_today.',
  scope: 'read',
  idempotent: true,
  mcp: false,
  http: { method: 'GET', path: '/follow-ups' },
  input: z.object({ completed: z.boolean().optional() }),
  output: z.object({ items: z.array(FollowUpSchema) }),
  async handler({ completed }) {
    const { followUps } = await repo.getWorkspaceData()
    return { items: completed === undefined ? followUps : followUps.filter((f) => !!f.completed === completed) }
  },
})

// -------------------------------------------------------------
// Deal writes
// -------------------------------------------------------------

const DealFields = {
  title: z.string().trim().min(1).max(100),
  stage: StageSchema,
  rawAmount: z.number().min(0).describe('Deal amount in the workspace currency (number). value is formatted from it.'),
  next: z.string().trim().max(200).describe('Next action: the concrete thing you do next, e.g. "Send proposal"'),
  nextDueDate: DueDateInput,
  waiting: z.boolean().describe('true = waiting on the client; no next action needed'),
  notes: z.string().max(50000).describe('Markdown notes (replaces existing notes; use add_note to append)'),
  startDate: DueDateInput.describe('Project start date'),
  endDate: DueDateInput.describe('Project deadline'),
  color: ColorSchema,
}

const createDeal = defineOperation({
  name: 'create_deal',
  title: 'Create a deal',
  description:
    'Create a deal for a client. Pass contactId for an existing client, or contactName (and contactEmail) to match or create one. Every deal needs next + nextDueDate unless waiting is true. Search first so you don\'t duplicate an existing deal.',
  scope: 'write',
  http: { method: 'POST', path: '/deals', status: 201 },
  input: z
    .object({
      title: DealFields.title,
      stage: DealFields.stage.optional().default('Lead'),
      contactId: z.string().optional().describe('Existing client id'),
      contactName: z.string().trim().max(100).optional().describe('Client name; matched or created when no contactId'),
      contactEmail: z.string().email().optional(),
      rawAmount: DealFields.rawAmount.optional(),
      next: DealFields.next.optional(),
      nextDueDate: DealFields.nextDueDate.optional(),
      waiting: DealFields.waiting.optional(),
      notes: DealFields.notes.optional(),
      startDate: DealFields.startDate.optional(),
      endDate: DealFields.endDate.optional(),
      color: DealFields.color.optional(),
    })
    .refine((d) => !!(d.contactId || d.contactName || d.contactEmail), {
      message: 'A client is required: pass contactId, or contactName',
      path: ['contactName'],
    }),
  output: DealSchema,
  example: {
    title: 'Portfolio website',
    contactName: 'Jana Nováková',
    contactEmail: 'jana@example.com',
    rawAmount: 45000,
    next: 'Send proposal',
    nextDueDate: 'friday',
  },
  async handler(input, ctx) {
    if (input.contactId) await loadClient(input.contactId)
    const settings = await moneySettings()
    const rawAmount = input.rawAmount ?? 0
    const draft: Omit<Deal, 'id'> = {
      title: input.title,
      stage: input.stage,
      value: formatMoney(rawAmount, settings),
      rawAmount,
      next: input.waiting ? input.next ?? '' : input.next ?? '',
      nextDueDate: parseDue(input.nextDueDate),
      waiting: input.waiting,
      color: input.color ?? 'blue',
      contactId: input.contactId,
      contactName: input.contactName ?? '',
      contactEmail: input.contactEmail,
      notes: input.notes,
      startDate: parseDue(input.startDate, 'startDate'),
      endDate: parseDue(input.endDate, 'endDate'),
      deliverables: [],
      invoices: [],
    }
    assertNextActionRule({ ...draft, id: 'new' })
    if (ctx.dryRun) return { ...draft, id: 'dry-run' }
    const created = await repo.createDeal(draft)
    const after = (await repo.getDealById(created.id)) ?? created
    ctx.record({ entityType: 'deal', entityId: created.id, after })
    return after
  },
})

const updateDeal = defineOperation({
  name: 'update_deal',
  title: 'Update a deal',
  description:
    'Change fields on a deal. Only the fields you pass change. For the common changes prefer the focused tools: advance_deal_stage, set_next_action, set_waiting, add_note, add_task.',
  scope: 'write',
  http: { method: 'PATCH', path: '/deals/{id}' },
  input: z.object({
    id: DealId,
    title: DealFields.title.optional(),
    stage: DealFields.stage.optional(),
    rawAmount: DealFields.rawAmount.optional(),
    next: DealFields.next.optional(),
    nextDueDate: DealFields.nextDueDate.nullable().optional(),
    waiting: DealFields.waiting.optional(),
    notes: DealFields.notes.nullable().optional(),
    startDate: DealFields.startDate.nullable().optional(),
    endDate: DealFields.endDate.nullable().optional(),
    color: DealFields.color.optional(),
    contactId: z.string().optional().describe('Move the deal to another existing client'),
  }),
  output: DealSchema,
  example: { id: 'deal-123', rawAmount: 52000, endDate: '2026-12-15' },
  async handler(input, ctx) {
    const settings = await moneySettings()
    if (input.contactId) await loadClient(input.contactId)
    const touchesNext = input.next !== undefined || input.nextDueDate !== undefined || input.waiting !== undefined
    return mutateDeal(
      ctx,
      input.id,
      (d) => {
        if (input.title !== undefined) d.title = input.title
        if (input.stage !== undefined) d.stage = input.stage
        if (input.rawAmount !== undefined) {
          d.rawAmount = input.rawAmount
          d.value = formatMoney(input.rawAmount, settings)
        }
        if (input.next !== undefined) d.next = input.next
        if (input.nextDueDate !== undefined) d.nextDueDate = parseDue(input.nextDueDate)
        if (input.waiting !== undefined) d.waiting = input.waiting
        if (input.notes !== undefined) d.notes = input.notes ?? undefined
        if (input.startDate !== undefined) d.startDate = parseDue(input.startDate, 'startDate')
        if (input.endDate !== undefined) d.endDate = parseDue(input.endDate, 'endDate')
        if (input.color !== undefined) d.color = input.color
        if (input.contactId) {
          d.contactId = input.contactId
          d.contactName = ''
          d.contactEmail = undefined
        }
        return d
      },
      { checkNextAction: touchesNext }
    )
  },
})

const deleteDeal = defineOperation({
  name: 'delete_deal',
  title: 'Delete a deal',
  description: 'Permanently delete a deal with its tasks, notes and invoices. Cannot be undone. Only when the user explicitly asks.',
  scope: 'write',
  destructive: true,
  mcp: false,
  http: { method: 'DELETE', path: '/deals/{id}' },
  input: z.object({ id: DealId }),
  output: DeletedSchema,
  async handler({ id }, ctx) {
    const before = await loadDeal(id, true)
    if (ctx.dryRun) return { id, deleted: false }
    await repo.deleteDeal(id)
    ctx.record({ entityType: 'deal', entityId: id, before })
    return { id, deleted: true }
  },
})

const advanceDealStage = defineOperation({
  name: 'advance_deal_stage',
  title: 'Move a deal to another stage',
  description:
    'Move a deal along the pipeline. Without stage it moves to the next one. Moving to Closed means the contract is signed and the deal becomes a project. Optionally set the next action for the new stage in the same call.',
  scope: 'write',
  idempotent: true,
  http: { method: 'POST', path: '/deals/{id}/stage' },
  input: z.object({
    id: DealId,
    stage: StageSchema.optional().describe('Target stage; omit to move one stage forward'),
    next: DealFields.next.optional().describe('Next action for the new stage'),
    nextDueDate: DealFields.nextDueDate.optional(),
  }),
  output: DealSchema,
  example: { id: 'deal-123', stage: 'Closed', next: 'Send deposit invoice', nextDueDate: 'tomorrow' },
  async handler(input, ctx) {
    return mutateDeal(
      ctx,
      input.id,
      (d) => {
        const target = input.stage ?? nextDealStage(d.stage)
        if (!target) {
          throw new ApiError('validation_failed', `"${d.title}" is already Completed, the last stage`, { field: 'stage' })
        }
        d.stage = target
        if (input.next !== undefined) {
          d.next = input.next
          d.waiting = false
        }
        if (input.nextDueDate !== undefined) d.nextDueDate = parseDue(input.nextDueDate)
        return d
      },
      { checkNextAction: input.next !== undefined || input.nextDueDate !== undefined }
    )
  },
})

const setNextAction = defineOperation({
  name: 'set_next_action',
  title: 'Set the next action',
  description:
    'Set what you do next on a deal and when. Clears waiting-on-client. Use after finishing the previous next action, or to fix deals listed under needsYou in get_today.',
  scope: 'write',
  idempotent: true,
  http: { method: 'POST', path: '/deals/{id}/next-action' },
  input: z.object({
    id: DealId,
    next: DealFields.next.min(1),
    nextDueDate: DealFields.nextDueDate,
  }),
  output: DealSchema,
  example: { id: 'deal-123', next: 'Call to confirm scope', nextDueDate: '2026-11-12' },
  async handler(input, ctx) {
    return mutateDeal(
      ctx,
      input.id,
      (d) => {
        d.next = input.next
        d.nextDueDate = parseDue(input.nextDueDate)
        d.waiting = false
        return d
      },
      { checkNextAction: true }
    )
  },
})

const setWaiting = defineOperation({
  name: 'set_waiting',
  title: 'Mark waiting on client',
  description:
    'waiting: true = the ball is in the client\'s court (no next action needed, shows under Waiting in get_today). waiting: false = it\'s your move again; pass next and nextDueDate unless the deal already has them.',
  scope: 'write',
  idempotent: true,
  http: { method: 'POST', path: '/deals/{id}/waiting' },
  input: z.object({
    id: DealId,
    waiting: z.boolean(),
    next: DealFields.next.optional().describe('When clearing waiting: your next action'),
    nextDueDate: DealFields.nextDueDate.optional(),
  }),
  output: DealSchema,
  example: { id: 'deal-123', waiting: true },
  async handler(input, ctx) {
    return mutateDeal(
      ctx,
      input.id,
      (d) => {
        d.waiting = input.waiting
        if (input.next !== undefined) d.next = input.next
        if (input.nextDueDate !== undefined) d.nextDueDate = parseDue(input.nextDueDate)
        return d
      },
      { checkNextAction: true }
    )
  },
})

const addNote = defineOperation({
  name: 'add_note',
  title: 'Add to deal notes',
  description:
    'Write to a deal\'s Markdown notes. mode "append" (default) adds a dated paragraph at the end; "replace" overwrites the whole note. Use for call summaries, decisions, client details. There is no activity log; notes are the record.',
  scope: 'write',
  http: { method: 'POST', path: '/deals/{id}/notes' },
  input: z.object({
    id: DealId,
    text: z.string().trim().min(1).max(20000),
    mode: z.enum(['append', 'replace']).optional().default('append'),
  }),
  output: DealSchema,
  example: { id: 'deal-123', text: 'Call: client wants a blog section, budget unchanged.' },
  async handler(input, ctx) {
    return mutateDeal(ctx, input.id, (d) => {
      if (input.mode === 'replace') {
        d.notes = input.text
      } else {
        const stamp = `**${normalizeDueDate('today')}**`
        d.notes = [d.notes?.trimEnd(), `${stamp} ${input.text}`].filter(Boolean).join('\n\n')
      }
      return d
    })
  },
})

// -------------------------------------------------------------
// Tasks (deal task board + client materials)
// -------------------------------------------------------------

const addTask = defineOperation({
  name: 'add_task',
  title: 'Add a task',
  description:
    'Add a card to a deal\'s task board. section "deliverables" (default) = your work; "podklady" = client materials, something the client owes you (logo, texts, access). Not for the next action; use set_next_action for that.',
  scope: 'write',
  http: { method: 'POST', path: '/deals/{id}/tasks', status: 201 },
  input: z.object({
    id: DealId,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).optional().describe('Markdown'),
    section: z.enum(['deliverables', 'podklady']).optional().default('deliverables'),
    column: BoardColumnSchema.optional().default('todo'),
    dueDate: DueDateInput.optional(),
  }),
  output: z.object({ task: TaskSchema, deal: DealSchema }),
  example: { id: 'deal-123', title: 'Homepage design', column: 'todo' },
  async handler(input, ctx) {
    const task: DeliverableItem = {
      id: newId('task'),
      title: input.title,
      description: input.description,
      status: taskStatusFor(input.column),
      column: input.column as DeliverableItem['column'],
      section: input.section,
      dueDate: parseDue(input.dueDate, 'dueDate'),
    }
    const deal = await mutateDeal(ctx, input.id, (d) => {
      if ((d.deliverables?.length ?? 0) >= 200) {
        throw new ApiError('validation_failed', 'A deal can hold at most 200 tasks')
      }
      d.deliverables = [...(d.deliverables ?? []), task]
      return d
    })
    return { task, deal }
  },
})

const updateTask = defineOperation({
  name: 'update_task',
  title: 'Update or move a task',
  description:
    'Change a task: move it between board columns (todo, waiting, blocked, done), rename it, edit its description or due date, or record client sign-off. column "done" marks it Done.',
  scope: 'write',
  idempotent: true,
  http: { method: 'PATCH', path: '/deals/{id}/tasks/{taskId}' },
  input: z.object({
    id: DealId,
    taskId: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(10000).optional(),
    column: BoardColumnSchema.optional(),
    dueDate: DueDateInput.nullable().optional(),
    clientSignOff: z.boolean().optional(),
  }),
  output: z.object({ task: TaskSchema, deal: DealSchema }),
  example: { id: 'deal-123', taskId: 'task-456', column: 'done' },
  async handler(input, ctx) {
    let updated: DeliverableItem | undefined
    const deal = await mutateDeal(ctx, input.id, (d) => {
      const task = findTask(d, input.taskId)
      if (input.title !== undefined) task.title = input.title
      if (input.description !== undefined) task.description = input.description
      if (input.column !== undefined) {
        task.column = input.column as DeliverableItem['column']
        task.status = taskStatusFor(input.column)
      }
      if (input.dueDate !== undefined) task.dueDate = parseDue(input.dueDate, 'dueDate')
      if (input.clientSignOff !== undefined) task.clientSignOff = input.clientSignOff
      updated = task
      return d
    })
    return { task: updated!, deal }
  },
})

const deleteTask = defineOperation({
  name: 'delete_task',
  title: 'Delete a task',
  description: 'Remove a task from a deal. Prefer moving it to done; delete only mistakes or duplicates.',
  scope: 'write',
  destructive: true,
  http: { method: 'DELETE', path: '/deals/{id}/tasks/{taskId}' },
  input: z.object({ id: DealId, taskId: z.string().min(1) }),
  output: DeletedSchema,
  async handler(input, ctx) {
    await mutateDeal(ctx, input.id, (d) => {
      findTask(d, input.taskId)
      d.deliverables = (d.deliverables ?? []).filter((t) => t.id !== input.taskId)
      return d
    })
    return { id: input.taskId, deleted: !ctx.dryRun }
  },
})

// -------------------------------------------------------------
// Invoices
// -------------------------------------------------------------

const addInvoice = defineOperation({
  name: 'add_invoice',
  title: 'Add an invoice milestone',
  description:
    'Add an invoice milestone to a deal (deposit, progress or final payment). Pass amount, or percentage of the deal value. Status starts as Draft.',
  scope: 'write',
  http: { method: 'POST', path: '/deals/{id}/invoices', status: 201 },
  input: z
    .object({
      id: DealId,
      type: z.enum(['Deposit', 'Progress', 'Final']),
      label: z.string().trim().min(1).max(200).optional().describe('Defaults to the type, e.g. "Deposit"'),
      amount: z.number().min(0).optional().describe('Amount in the workspace currency'),
      percentage: z.number().min(0).max(100).optional().describe('Share of the deal value, 0-100'),
      status: z.enum(['Draft', 'Sent', 'Paid', 'Overdue']).optional().default('Draft'),
      dueDate: DueDateInput.optional(),
      paymentLink: z.string().url().optional(),
    })
    .refine((i) => i.amount !== undefined || i.percentage !== undefined, {
      message: 'Pass amount or percentage',
      path: ['amount'],
    }),
  output: z.object({ invoice: InvoiceOutSchema, deal: DealSchema }),
  example: { id: 'deal-123', type: 'Deposit', percentage: 50, dueDate: 'in 7 days' },
  async handler(input, ctx) {
    const settings = await moneySettings()
    let invoice: InvoiceMilestone | undefined
    const deal = await mutateDeal(ctx, input.id, (d) => {
      const total = d.rawAmount || 0
      const amount = input.amount ?? Math.round((total * (input.percentage ?? 0)) / 100)
      const percentage = input.percentage ?? (total > 0 ? Math.round((amount / total) * 100) : 0)
      invoice = {
        id: newId('inv'),
        type: input.type,
        label: input.label ?? input.type,
        amount,
        formattedAmount: formatMoney(amount, settings),
        percentage: Math.min(percentage, 100),
        status: input.status,
        dueDate: parseDue(input.dueDate, 'dueDate'),
        paidAt: input.status === 'Paid' ? new Date().toISOString() : undefined,
        paymentLink: input.paymentLink,
      }
      d.invoices = [...(d.invoices ?? []), invoice]
      return d
    })
    return { invoice: invoice!, deal }
  },
})

const updateInvoice = defineOperation({
  name: 'update_invoice',
  title: 'Update an invoice milestone',
  description: 'Change an invoice: mark it Sent, Paid or Overdue, change the amount or due date. Marking Paid records paidAt.',
  scope: 'write',
  idempotent: true,
  http: { method: 'PATCH', path: '/deals/{id}/invoices/{invoiceId}' },
  input: z.object({
    id: DealId,
    invoiceId: z.string().min(1),
    status: z.enum(['Draft', 'Sent', 'Paid', 'Overdue']).optional(),
    amount: z.number().min(0).optional(),
    label: z.string().trim().min(1).max(200).optional(),
    dueDate: DueDateInput.nullable().optional(),
    paymentLink: z.string().url().nullable().optional(),
  }),
  output: z.object({ invoice: InvoiceOutSchema, deal: DealSchema }),
  example: { id: 'deal-123', invoiceId: 'inv-789', status: 'Paid' },
  async handler(input, ctx) {
    const settings = await moneySettings()
    let updated: InvoiceMilestone | undefined
    const deal = await mutateDeal(ctx, input.id, (d) => {
      const inv = findInvoice(d, input.invoiceId)
      if (input.status !== undefined) {
        if (input.status === 'Paid' && inv.status !== 'Paid') inv.paidAt = new Date().toISOString()
        if (input.status !== 'Paid') inv.paidAt = undefined
        inv.status = input.status
      }
      if (input.amount !== undefined) {
        inv.amount = input.amount
        inv.formattedAmount = formatMoney(input.amount, settings)
        if (d.rawAmount > 0) inv.percentage = Math.min(100, Math.round((input.amount / d.rawAmount) * 100))
      }
      if (input.label !== undefined) inv.label = input.label
      if (input.dueDate !== undefined) inv.dueDate = parseDue(input.dueDate, 'dueDate')
      if (input.paymentLink !== undefined) inv.paymentLink = input.paymentLink ?? undefined
      updated = inv
      return d
    })
    return { invoice: updated!, deal }
  },
})

// -------------------------------------------------------------
// Clients
// -------------------------------------------------------------

const createClient = defineOperation({
  name: 'create_client',
  title: 'Create a client',
  description:
    'Add a client (a person, never a company). Fails with conflict when a client with the same email exists; use that client instead. To start work for a new client in one step, call create_deal with contactName.',
  scope: 'write',
  http: { method: 'POST', path: '/clients', status: 201 },
  input: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    notes: z.string().max(5000).optional().describe('Markdown; company or role can go here'),
    color: ColorSchema.optional(),
  }),
  output: ClientSchema,
  example: { name: 'Jana Nováková', email: 'jana@example.com' },
  async handler(input, ctx) {
    const { contacts } = await repo.getWorkspaceData()
    const email = input.email?.trim().toLowerCase()
    const dupe = email && contacts.find((c) => c.email.trim().toLowerCase() === email)
    if (dupe) {
      throw new ApiError('conflict', `Client "${dupe.name}" already has the email ${input.email}`, {
        field: 'email',
        hint: `Use the existing client id "${dupe.id}".`,
      })
    }
    const draft: Omit<Contact, 'id'> = {
      name: input.name,
      email: input.email ?? '',
      phone: input.phone,
      notes: input.notes,
      deals: 0,
      lastTouch: 'Today',
      color: input.color ?? 'blue',
    }
    if (ctx.dryRun) return { ...draft, id: 'dry-run' }
    const created = await repo.createContact(draft)
    ctx.record({ entityType: 'client', entityId: created.id, after: created })
    queueContactSync(created.id)
    return created
  },
})

const updateClient = defineOperation({
  name: 'update_client',
  title: 'Update a client',
  description: 'Change a client\'s name, email, phone or notes. Name and email changes also update the client\'s deals.',
  scope: 'write',
  idempotent: true,
  http: { method: 'PATCH', path: '/clients/{id}' },
  input: z.object({
    id: z.string().min(1).describe('Client id'),
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().or(z.literal('')).optional(),
    phone: z.string().max(50).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    color: ColorSchema.optional(),
  }),
  output: ClientSchema,
  async handler(input, ctx) {
    const before = await loadClient(input.id)
    const next: Contact = {
      ...before,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? undefined } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? undefined } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    }
    if (ctx.dryRun) return next
    const saved = await repo.updateContact(next)
    if (!saved) throw notFound('Client', input.id)
    ctx.record({ entityType: 'client', entityId: input.id, before, after: saved })
    queueContactSync(saved.id)
    return saved
  },
})

const deleteClient = defineOperation({
  name: 'delete_client',
  title: 'Delete a client',
  description: 'Permanently delete a client. Fails while the client still has deals. Only when the user explicitly asks.',
  scope: 'write',
  destructive: true,
  mcp: false,
  http: { method: 'DELETE', path: '/clients/{id}' },
  input: z.object({ id: z.string().min(1) }),
  output: DeletedSchema,
  async handler({ id }, ctx) {
    const before = await loadClient(id)
    const { deals } = await repo.getWorkspaceData()
    if (deals.some((d) => d.contactId === id)) {
      throw new ApiError('conflict', `"${before.name}" still has deals`, { hint: 'Delete or move their deals first.' })
    }
    if (ctx.dryRun) return { id, deleted: false }
    await repo.deleteContact(id)
    ctx.record({ entityType: 'client', entityId: id, before })
    return { id, deleted: true }
  },
})

// -------------------------------------------------------------
// Follow-ups (REST only; deal next actions cover most needs)
// -------------------------------------------------------------

const createFollowUp = defineOperation({
  name: 'create_follow_up',
  title: 'Create a follow-up',
  description: 'Add a standalone reminder for today. Prefer set_next_action on a deal.',
  scope: 'write',
  mcp: false,
  http: { method: 'POST', path: '/follow-ups', status: 201 },
  input: z.object({
    action: z.string().trim().min(1).max(200),
    company: z.string().trim().max(100).optional().describe('Label, e.g. the client name'),
    dealId: z.string().optional(),
  }),
  output: FollowUpSchema,
  async handler(input, ctx) {
    if (input.dealId) await loadDeal(input.dealId, true)
    if (ctx.dryRun) {
      return { id: 'dry-run', day: 'Today', company: input.company ?? 'Workspace', action: input.action, time: '14:00', tone: 'urgent', completed: false }
    }
    const [created] = await repo.syncTodos([input.action], input.company || 'Workspace', input.dealId)
    ctx.record({ entityType: 'follow_up', entityId: created.id, after: created })
    return created
  },
})

const toggleFollowUp = defineOperation({
  name: 'toggle_follow_up',
  title: 'Complete or reopen a follow-up',
  description: 'Flip a standalone follow-up between done and open. Deal next actions are changed with set_next_action instead.',
  scope: 'write',
  mcp: false,
  http: { method: 'POST', path: '/follow-ups/{id}/toggle' },
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ id: z.string(), completed: z.boolean() }),
  async handler({ id }, ctx) {
    const { followUps } = await repo.getWorkspaceData()
    const before = followUps.find((f) => f.id === id)
    if (!before) throw notFound('Follow-up', id, 'Call list_follow_ups to find the id.')
    if (ctx.dryRun) return { id, completed: !before.completed }
    const completed = await repo.toggleFollowUp(id)
    ctx.record({ entityType: 'follow_up', entityId: id, before, after: { ...before, completed } })
    return { id, completed }
  },
})

/** Every operation, in the order docs and tool lists show them */
export const OPERATIONS: Operation[] = [
  getWorkspace,
  getToday,
  getProjectsOverview,
  search,
  listDeals,
  getDeal,
  listClients,
  getClient,
  listFollowUps,
  createDeal,
  updateDeal,
  advanceDealStage,
  setNextAction,
  setWaiting,
  addNote,
  addTask,
  updateTask,
  deleteTask,
  addInvoice,
  updateInvoice,
  deleteDeal,
  createClient,
  updateClient,
  deleteClient,
  createFollowUp,
  toggleFollowUp,
] as unknown as Operation[]

export const OPERATIONS_BY_NAME = new Map(OPERATIONS.map((op) => [op.name, op]))
