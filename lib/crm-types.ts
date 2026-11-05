export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Won'
  | 'Záloha'
  | 'Podklady'
  | 'Build'
  | 'Handoff'
  | 'Revisions'
  | 'Vady'

/**
 * One deal, one pipeline, in order — the single source for types, validation,
 * filters, pickers and counts.
 * CRM: Lead → Qualified → Proposal. Won = contract signed = CRM→PM handoff.
 * PM: Záloha → Podklady → Build → Handoff → Revisions → Vady.
 */
export const DEAL_STAGES = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Záloha',
  'Podklady',
  'Build',
  'Handoff',
  'Revisions',
  'Vady',
] as const satisfies readonly DealStage[]

/** Stages a deal is still being won in (CRM side, everything before Won) */
export const OPEN_DEAL_STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal']

/** Won and everything after it: the contract is signed and project work runs (PM side) */
export const PM_STAGES: DealStage[] = DEAL_STAGES.filter((s) => !OPEN_DEAL_STAGES.includes(s))

/** PM stages where the project is still being delivered (Vady = warranty only) */
export const ACTIVE_PROJECT_STAGES: DealStage[] = PM_STAGES.filter((s) => s !== 'Vady')

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
  Won: 'Contract signed, project starts',
  Záloha: 'Deposit / advance invoiced',
  Podklady: 'Waiting on client materials',
  Build: 'Building, preview shared',
  Handoff: 'Handed over, final payment due',
  Revisions: 'Client revisions',
  Vady: 'Vady / záruka (warranty)',
}

/** Checklist groups on a deal. Podklady = what the client owes you. */
export type ChecklistSection = 'podklady' | 'deliverables'

export interface DeliverableItem {
  id: string
  title: string
  status: 'Pending' | 'In Progress' | 'Done'
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

