export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Won'

/**
 * Pipeline stages in order — the single source for types, validation, filters,
 * pickers and counts.
 * Lead = first contact · Qualified = call + scope · Proposal = contract sent ·
 * Won = contract signed (handoff to project work).
 */
export const DEAL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Won'] as const satisfies readonly DealStage[]

/** Stages a deal is still being won in (everything before Won) */
export const OPEN_DEAL_STAGES: DealStage[] = DEAL_STAGES.filter((s) => s !== 'Won')

/** One-line meaning of each stage, for helper copy */
export const DEAL_STAGE_HINTS: Record<DealStage, string> = {
  Lead: 'First contact',
  Qualified: 'Call done, scope agreed',
  Proposal: 'Contract sent',
  Won: 'Contract signed, ready to start',
}

export interface DeliverableItem {
  id: string
  title: string
  status: 'Pending' | 'In Progress' | 'Done'
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

export interface Activity {
  id: string
  dealId?: string
  type: 'Call' | 'Meeting' | 'Email' | 'Follow-up' | 'Note'
  title: string
  person: string
  company: string
  date: string
  status: 'Due today' | 'Upcoming' | 'Completed'
  color: 'blue' | 'violet' | 'amber' | 'green'
  summary?: string
  notes?: string
  dueDate?: string
  createdAt?: string
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
  activities: Activity[]
  followUps: FollowUpItem[]
  settings?: WorkspaceSettings
}

