export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Closed'
  | 'Deposit'
  | 'Materials'
  | 'Build'
  | 'Handoff'
  | 'Revisions'
  | 'Completed'

/**
 * One deal, one pipeline, in order — the single source for types, validation,
 * filters, pickers and counts.
 * CRM: Lead → Qualified → Proposal. Closed = contract signed = CRM→PM handoff.
 * PM: Deposit → Materials → Build → Handoff → Revisions → Completed.
 */
export const DEAL_STAGES = [
  'Lead',
  'Qualified',
  'Proposal',
  'Closed',
  'Deposit',
  'Materials',
  'Build',
  'Handoff',
  'Revisions',
  'Completed',
] as const satisfies readonly DealStage[]

/** Stages a deal is still being won in (CRM side, everything before Closed) */
export const OPEN_DEAL_STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal']

/** Closed and everything after it: the contract is signed and project work runs (PM side) */
export const PM_STAGES: DealStage[] = DEAL_STAGES.filter((s) => !OPEN_DEAL_STAGES.includes(s))

/** PM stages where the project is still being delivered (Completed = finished) */
export const ACTIVE_PROJECT_STAGES: DealStage[] = PM_STAGES.filter((s) => s !== 'Completed')

export const isPmStage = (stage: DealStage) => PM_STAGES.includes(stage)

/** The stage after this one, or null at the end of the pipeline */
export function nextDealStage(stage: DealStage): DealStage | null {
  const i = DEAL_STAGES.indexOf(stage)
  return i === -1 || i === DEAL_STAGES.length - 1 ? null : DEAL_STAGES[i + 1]
}

/** One-line meaning of each stage, for helper copy */
export const DEAL_STAGE_HINTS: Record<DealStage, string> = {
  Lead: 'First contact',
  Qualified: 'Call done, scope agreed',
  Proposal: 'Contract sent',
  Closed: 'Contract signed, project starts',
  Deposit: 'Deposit invoiced, waiting for payment',
  Materials: 'Waiting on client materials',
  Build: 'Building, preview shared',
  Handoff: 'Handed over, final payment due',
  Revisions: 'Client revisions',
  Completed: 'Delivered and paid, project finished',
}

/** Checklist groups on a deal. 'podklady' (stored key) = client materials, what the client owes you. */
export type ChecklistSection = 'podklady' | 'deliverables'

/** Task board columns on a deal, in order (Trello-style) */
export const BOARD_COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
] as const
export type BoardColumnId = (typeof BOARD_COLUMNS)[number]['id']

/** Column a card sits in; cards saved before the board existed fall back to their status */
export function cardColumn(item: DeliverableItem): BoardColumnId {
  return item.column ?? (item.status === 'Done' ? 'done' : 'todo')
}

export interface DeliverableItem {
  id: string
  title: string
  /** Markdown description of a board card */
  description?: string
  status: 'Pending' | 'In Progress' | 'Done'
  /** Task board column; kept in step with status (done column = Done) */
  column?: BoardColumnId
  /** Checklist group; items without one are deliverables */
  section?: ChecklistSection
  clientSignOff?: boolean
  dueDate?: string
}

export interface InvoiceMilestone {
  id: string
  type: 'Deposit' | 'Progress' | 'Final'
  label: string
  amount: number
  formattedAmount: string
  percentage: number
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue'
  dueDate?: string
  paidAt?: string
  paymentLink?: string
}

export interface Deal {
  id: string
  title: string
  value: string
  rawAmount: number
  stage: DealStage
  next: string
  nextDueDate?: string
  /** Ball is in the client's court: next action is a chase date, not a to-do */
  waiting?: boolean
  /** ISO timestamp of when the deal started waiting on the client */
  waitingSince?: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  /** The client (person) this deal belongs to */
  contactId?: string
  contactName: string
  contactEmail?: string
  notes?: string
  createdAt?: string
  startDate?: string
  endDate?: string
  deliverables?: DeliverableItem[]
  invoices?: InvoiceMilestone[]
}

export interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  notes?: string
  deals: number
  lastTouch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
}

export interface FollowUpItem {
  id: string
  day: 'Today' | 'Tomorrow' | 'This week' | 'Next week' | 'Later' | string
  company: string
  action: string
  time: string
  tone: 'urgent' | 'normal'
  completed?: boolean
}

export interface WorkspaceSettings {
  operatorName: string
  operatorEmail: string
  operatorRole: string
  currency: string
  currencySymbol: string
  locale: string
  isClaimed: boolean
  calendarFeedToken?: string
  updatedAt?: string
}

export interface WorkspaceData {
  deals: Deal[]
  contacts: Contact[]
  followUps: FollowUpItem[]
  settings?: WorkspaceSettings
}

